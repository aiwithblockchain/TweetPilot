import type { ExecutionChannel as BaseExecutionChannel } from "./types";

export type ExecutionChannel = BaseExecutionChannel;
export type ExecutionChannelType = ExecutionChannel["type"];
export type ExecutionChannelStatus = ExecutionChannel["status"];
