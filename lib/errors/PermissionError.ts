import { AppError } from "./AppError";
export class PermissionError extends AppError { constructor(safeMessage = "No tienes permiso para realizar esta acción.") { super("PERMISSION_DENIED", 403, safeMessage); } }
