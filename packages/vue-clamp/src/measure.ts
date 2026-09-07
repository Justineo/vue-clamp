import { queuePostFlushCb } from "vue";
import { hasMeasuredPeers, isContentIndependentWidth } from "./layout.ts";

// Intrinsic widths can redistribute space when another candidate changes. Keep
// those searches serial; percentages need an explicit immediate parent width.
export function hasExplicitTextWidth(element: HTMLElement): boolean {
  const width = element.style.width.trim();
  return (
    isContentIndependentWidth(width) ||
    (/^(?:\d+|\d*\.\d+)%$/u.test(width) &&
      isContentIndependentWidth(element.parentElement?.style.width.trim() ?? ""))
  );
}

type MeasurementTask<T, V> = Generator<() => V, T, V>;

type PendingMeasurement = {
  advance: (value: unknown) => boolean;
  read: () => unknown;
  value: unknown;
  complete: () => void;
  reject: (error: unknown) => void;
};

let pending: PendingMeasurement[] = [];

function advance(job: PendingMeasurement, completed: PendingMeasurement[]): boolean {
  try {
    if (job.advance(job.value)) return true;
    completed.push(job);
    return false;
  } catch (error) {
    job.reject(error);
    return false;
  }
}

function flushMeasurements(): void {
  let jobs = pending;
  pending = [];
  const completed: PendingMeasurement[] = [];
  jobs = jobs.filter((job) => advance(job, completed));

  while (jobs.length > 0) {
    // Complete every read before resuming any task: resuming writes the next
    // candidate and would otherwise invalidate layout for the remaining reads.
    jobs = jobs.filter((job) => {
      try {
        job.value = job.read();
        return true;
      } catch (error) {
        job.reject(error);
        return false;
      }
    });
    jobs = jobs.filter((job) => advance(job, completed));
  }
  // Commit reactive state before Vue's post-flush phase returns, so nextTick
  // observes both final text and accessibility markup. Final snapshots run only
  // after every task has finished writing its candidate.
  for (const job of completed) {
    try {
      job.complete();
    } catch (error) {
      job.reject(error);
    }
  }
}

export function measureLayout<T, V>(
  task: MeasurementTask<T, V>,
  isCurrent: () => boolean,
  complete: (value: T) => void,
  batch = true,
): Promise<T | null> {
  return new Promise((resolve, reject) => {
    // A lone measured clamp has no cross-instance layout work to amortize.
    if (!batch || !hasMeasuredPeers()) {
      if (!isCurrent()) {
        resolve(null);
        return;
      }
      let step = task.next();
      while (!step.done) step = task.next(step.value());
      complete(step.value);
      resolve(step.value);
      return;
    }
    const job: PendingMeasurement = {
      advance(value) {
        if (!isCurrent()) {
          resolve(null);
          return false;
        }
        // A job only resumes with the value returned by its own typed reader.
        const step = task.next(value as V);
        if (step.done) {
          job.complete = () => {
            if (isCurrent()) {
              complete(step.value);
              resolve(step.value);
            } else {
              resolve(null);
            }
          };
          return false;
        }
        job.read = step.value;
        return true;
      },
      read: () => 0,
      value: 0,
      complete: () => {},
      reject,
    };
    pending.push(job);
    if (pending.length === 1) {
      queuePostFlushCb(flushMeasurements);
    }
  });
}
