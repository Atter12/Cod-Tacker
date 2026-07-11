import type {
  WhatsappConversationRow,
  WhatsappMessageRow,
  WhatsappTemplateRow,
} from "@/types/database";
import { requireValue, throwQueryError, type DatabaseClient } from "./_shared";

export async function listConversationsPaginated(
  client: DatabaseClient,
  options: {
    storeId: string;
    page?: number;
    pageSize?: number;
    search?: string;
    confirmationStatus?: string;
  },
): Promise<{ rows: WhatsappConversationRow[]; total: number; page: number; pageSize: number }> {
  const page = Math.max(1, options.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, options.pageSize ?? 25));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = client
    .from("whatsapp_conversations")
    .select("*", { count: "exact" })
    .eq("store_id", requireValue(options.storeId, "Tienda inválida."));

  if (options.confirmationStatus) {
    query = query.eq("confirmation_status", options.confirmationStatus as never);
  }
  const search = options.search?.trim();
  if (search) {
    const escaped = search.replace(/[%_,]/g, "").slice(0, 80);
    if (escaped) query = query.ilike("phone", `%${escaped}%`);
  }

  const result = await query
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .range(from, to);
  throwQueryError(result.error);
  return { rows: result.data ?? [], total: result.count ?? 0, page, pageSize };
}

export async function getConversationById(
  client: DatabaseClient,
  storeId: string,
  conversationId: string,
): Promise<WhatsappConversationRow | null> {
  const result = await client
    .from("whatsapp_conversations")
    .select()
    .eq("store_id", storeId)
    .eq("id", conversationId)
    .maybeSingle();
  throwQueryError(result.error);
  return result.data;
}

export async function listMessages(
  client: DatabaseClient,
  storeId: string,
  conversationId: string,
): Promise<WhatsappMessageRow[]> {
  const result = await client
    .from("whatsapp_messages")
    .select()
    .eq("store_id", storeId)
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });
  throwQueryError(result.error);
  return result.data ?? [];
}

export async function listTemplates(
  client: DatabaseClient,
  storeId: string,
): Promise<WhatsappTemplateRow[]> {
  const result = await client
    .from("whatsapp_templates")
    .select()
    .eq("store_id", storeId)
    .order("updated_at", { ascending: false });
  throwQueryError(result.error);
  return result.data ?? [];
}

export async function getTemplateById(
  client: DatabaseClient,
  storeId: string,
  templateId: string,
): Promise<WhatsappTemplateRow | null> {
  const result = await client
    .from("whatsapp_templates")
    .select()
    .eq("store_id", storeId)
    .eq("id", templateId)
    .maybeSingle();
  throwQueryError(result.error);
  return result.data;
}
