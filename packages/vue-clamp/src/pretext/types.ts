import type {
  LineClampExposed as StandardLineClampExposed,
  LineClampProps as StandardLineClampProps,
  LineClampSlotProps as StandardLineClampSlotProps,
  LineClampSlots as StandardLineClampSlots,
} from "../line/types.ts";

export type LineClampExposed = StandardLineClampExposed;

export type LineClampSlotProps = StandardLineClampSlotProps;

export type LineClampSlots = StandardLineClampSlots;

export interface LineClampProps extends StandardLineClampProps {
  font?: string;
}
