import type { ClampLocation } from "../src/types.ts";

export interface BenchmarkDomFixture {
  rootElement: HTMLElement;
  contentElement: HTMLElement;
  textElement: HTMLElement;
  beforeElement: HTMLElement | null;
  afterElement: HTMLElement | null;
}

export interface BenchmarkClampInput {
  fixture: BenchmarkDomFixture;
  text: string;
  ellipsis: string;
  location: ClampLocation;
  maxLines?: number;
  maxHeight?: number | string;
}
