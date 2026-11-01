"use client";

/** The task being dragged to the calendar. Browsers hide drag data until the drop, so it's kept here. */

import type { Task } from "./types";

let dragged: Task | null = null;

export const setDraggedTask = (task: Task | null) => {
  dragged = task;
};

export const draggedTask = () => dragged;
