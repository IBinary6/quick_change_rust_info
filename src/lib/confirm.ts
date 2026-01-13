export type ConfirmTone = "default" | "warning" | "danger";

export interface ConfirmOptions {
  title?: string;
  message: string;
  okLabel?: string;
  cancelLabel?: string;
  tone?: ConfirmTone;
}

export type ConfirmAction = (options: ConfirmOptions) => Promise<boolean>;
