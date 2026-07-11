"use client";

import { useMemo, useState, useTransition } from "react";
import { enterStore } from "@/app/actions/stores";
import { CreateStoreForm } from "@/components/agency/CreateStoreForm";
import { Alert } from "@/components/ui";
import { AccountSummary } from "@/components/store-selector/AccountSummary";
import { CreateStoreCard } from "@/components/store-selector/CreateStoreCard";
import { EmptyStoresState } from "@/components/store-selector/EmptyStoresState";
import { RecentAccountActivity } from "@/components/store-selector/RecentAccountActivity";
import { StoreCard } from "@/components/store-selector/StoreCard";
import { StoreSearch } from "@/components/store-selector/StoreSearch";
import { StoreSelectorHeader } from "@/components/store-selector/StoreSelectorHeader";
import { StoreSelectorLogout } from "@/components/store-selector/StoreSelectorLogout";
import { routes } from "@/config/routes";
import type { StoreSelectorPageData } from "@/services/store-selector.service";

function normalize(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function StoreSelectorExperience({ data }: { data: StoreSelectorPageData }) {
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string>();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [pending, startTransition] = useTransition();

  const displayName = data.user.fullName?.trim() || data.user.email || "Usuario";

  const filtered = useMemo(() => {
    const q = normalize(query);
    if (!q) return data.stores;
    return data.stores.filter(
      (store) =>
        normalize(store.name).includes(q) ||
        normalize(store.agencyName).includes(q) ||
        normalize(store.storeSlug).includes(q),
    );
  }, [data.stores, query]);

  function selectStore(agencySlug: string, storeSlug: string, storeId: string) {
    setError(undefined);
    setPendingId(storeId);
    startTransition(async () => {
      const result = await enterStore(agencySlug, storeSlug);
      if (result?.error) {
        setError(result.error);
        setPendingId(null);
      }
    });
  }

  return (
    <div className="store-selector-experience relative flex min-h-dvh flex-col overflow-x-hidden bg-[#050B16] text-[#F8FAFC]">
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div className="login-experience-grid absolute inset-0 opacity-[0.03]" />
        <div className="absolute -right-24 top-[-6%] size-[380px] rounded-full bg-[#164E63]/30 blur-3xl" />
        <div className="absolute -left-24 bottom-[-8%] size-[340px] rounded-full bg-[#19C7B5]/14 blur-3xl" />
      </div>

      <div className="relative z-10 flex min-h-dvh flex-col">
        <StoreSelectorHeader
          userName={displayName}
          email={data.user.email}
          avatarUrl={data.user.avatarUrl}
        />

        <main className="mx-auto flex w-full max-w-[1180px] flex-1 flex-col justify-center px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
          <div className="w-full">
            <div className="max-w-xl">
              <h1 className="text-[28px] font-bold leading-[1.15] tracking-tight text-[#F8FAFC] sm:text-[32px] lg:text-[34px]">
                Elige una tienda para continuar
              </h1>
              <p className="mt-2.5 text-[14px] leading-relaxed text-[#94A3B8] sm:text-[14.5px]">
                CODTracked organiza varias tiendas dentro de una misma plataforma. Selecciona el
                negocio que quieres monitorear ahora.
              </p>
            </div>

            <div className="mt-5 w-full max-w-md">
              <StoreSearch value={query} onChange={setQuery} />
            </div>

            <div className="mt-4" aria-live="polite">
              {error ? (
                <Alert variant="danger" title="No se pudo abrir la tienda">
                  {error}
                </Alert>
              ) : null}
            </div>

            <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(220px,260px)] lg:items-start lg:gap-8">
              <div className="order-1 min-w-0 space-y-5">
                {data.stores.length === 0 ? (
                  <EmptyStoresState
                    canCreate={data.createStore.visible && data.createStore.enabled}
                    createHref={
                      data.createStore.agencySlug
                        ? routes.agency.stores(data.createStore.agencySlug)
                        : null
                    }
                  />
                ) : filtered.length === 0 ? (
                  <p className="rounded-xl border border-[rgba(76,139,170,0.16)] bg-[#0A1729]/60 px-4 py-6 text-sm text-[#94A3B8]">
                    No encontramos tiendas con ese nombre.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 gap-4 min-[560px]:grid-cols-2 xl:grid-cols-3">
                    {filtered.map((store) => (
                      <StoreCard
                        key={store.storeId}
                        store={store}
                        pending={pendingId === store.storeId}
                        disabled={pending && pendingId !== store.storeId}
                        onSelect={() =>
                          selectStore(store.agencySlug, store.storeSlug, store.storeId)
                        }
                      />
                    ))}
                    {!query ? (
                      <CreateStoreCard
                        eligibility={data.createStore}
                        onOpen={() => setShowCreate(true)}
                      />
                    ) : null}
                  </div>
                )}

                {data.createStore.visible &&
                data.createStore.enabled &&
                data.createStore.agencySlug &&
                showCreate ? (
                  <div className="rounded-[16px] border border-[rgba(76,139,170,0.22)] bg-[#0D1B30] p-4 sm:p-5">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <h2 className="text-sm font-semibold text-[#F8FAFC]">Crear nueva tienda</h2>
                      <button
                        type="button"
                        className="text-xs text-[#94A3B8] hover:text-[#F8FAFC]"
                        onClick={() => setShowCreate(false)}
                      >
                        Cerrar
                      </button>
                    </div>
                    <div className="store-selector-create-form">
                      <CreateStoreForm agencySlug={data.createStore.agencySlug} />
                    </div>
                  </div>
                ) : null}

                <div className="hidden lg:block">
                  <RecentAccountActivity events={data.activity} />
                </div>
              </div>

              <aside className="order-2 space-y-3 lg:sticky lg:top-6">
                <div className="rounded-[18px] border border-[rgba(76,139,170,0.2)] bg-[#09162A] p-4 shadow-[0_16px_36px_rgba(0,0,0,0.25)] sm:p-5">
                  <AccountSummary summary={data.summary} error={data.summaryError} embedded />
                  <div className="mt-4 border-t border-[rgba(76,139,170,0.16)] pt-4">
                    <StoreSelectorLogout />
                  </div>
                </div>
              </aside>

              <div className="order-3 lg:hidden">
                <RecentAccountActivity events={data.activity} />
              </div>
            </div>
          </div>

          <p className="mt-8 text-center text-[11px] text-[#475569] sm:mt-6 lg:text-left">
            Selecciona una tienda para continuar a tu espacio operativo.
          </p>
        </main>
      </div>
    </div>
  );
}
