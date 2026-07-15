/** Empty-state aware customer label for order lists. */
export function labelOrderCustomer(input: {
  customerName?: string | null;
  customerPhone?: string | null;
  customerEmail?: string | null;
}): { text: string; isEmpty: boolean } {
  const name = input.customerName?.trim();
  if (name) return { text: name, isEmpty: false };
  const phone = input.customerPhone?.trim();
  if (phone) return { text: phone, isEmpty: false };
  const email = input.customerEmail?.trim();
  if (email) return { text: email, isEmpty: false };
  return { text: "Sin cliente", isEmpty: true };
}
