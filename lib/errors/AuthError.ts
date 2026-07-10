import { AppError } from "./AppError";
export class AuthError extends AppError { constructor(safeMessage = "Debes iniciar sesión para continuar.") { super("AUTH_ERROR", 401, safeMessage); } }
