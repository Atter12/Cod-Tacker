import { AppError } from "./AppError";
export class ValidationError extends AppError { constructor(safeMessage = "Revisa los datos ingresados.") { super("VALIDATION_ERROR", 400, safeMessage); } }
