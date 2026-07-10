import { AppError } from "./AppError";
export class IntegrationError extends AppError { constructor(safeMessage = "No fue posible completar la integración.", status = 502) { super("INTEGRATION_ERROR", status, safeMessage); } }
