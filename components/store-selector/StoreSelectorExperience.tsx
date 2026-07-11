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
        <div className="login-experience-grid absolute inset-0 opacity-[0.022]" />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent_40%,rgba(8,47,73,0.18)_100%)]" />
        <div className="absolute -right-[120px] -top-[190px] hidden size-[480px] rounded-full bg-[rgba(14,94,117,0.26)] sm:block" />
        <div className="absolute -bottom-[200px] -left-[110px] hidden size-[360px] rounded-full bg-[rgba(49,46,129,0.30)] sm:block" />
      </div>

      <div className="relative z-10 flex min-h-dvh flex-col">
        <StoreSelectorHeader
          userName={displayName}
          email={data.user.email}
          avatarUrl={data.user.avatarUrl}
        />

        <main className="mx-auto flex w-full max-w-[1520px] flex-1 flex-col px-5 pb-8 pt-10 sm:px-8 sm:pb-10 sm:pt-12 xl:px-10">
          <div className="grid w-full grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_220px] lg:gap-10 xl:grid-cols-[minmax(0,1fr)_240px] xl:gap-14 2xl:grid-cols-[minmax(0,1fr)_250px] 2xl:gap-16">
            <section className="flex min-h-0 flex-col lg:min-h-[calc(100dvh-64px-88px)]">
              <header className="max-w-[640px]">
                <h1 className="text-[31px] font-bold leading-[1.1] tracking-tight text-[#F8FAFC] sm:text-[33px]">
                  Elige una tienda para continuar
                </h1>
                <p className="mt-2.5 max-w-[620px] text-[14px] leading-[1.5] text-[#94A3B8]">
                  CODTracked organiza varias tiendas dentro de una misma plataforma. Selecciona el
                  negocio que quieres monitorear ahora.
                </p>
              </header>

              <div className="mt-5 w-full sm:mt-6 sm:max-w-[410px]">
                <StoreSearch value={query} onChange={setQuery} />
              </div>

              <div className="mt-4" aria-live="polite">
                {error ? (
                  <Alert variant="danger" title="No se pudo abrir la tienda">
                    {error}
                  </Alert>
                ) : null}
              </div>

              <div className="mt-7">
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
                  <p className="rounded-[16px] border border-[rgba(76,139,170,0.16)] bg-[#0A1729]/60 px-4 py-6 text-sm text-[#94A3B8]">
                    No encontramos tiendas con ese nombre.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 gap-5 min-[768px]:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3">
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
              </div>

              {data.createStore.visible &&
              data.createStore.enabled &&
              data.createStore.agencySlug &&
              showCreate ? (
                <div className="mt-5 rounded-[16px] border border-[rgba(76,139,170,0.22)] bg-[#0D1B30] p-4 sm:p-5">
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

              <div className="mt-8 lg:mt-auto lg:pt-24">
                <RecentAccountActivity events={data.activity} />
              </div>
            </section>

            <aside className="self-start lg:sticky lg:top-8">
              <div className="rounded-[19px] border border-[rgba(76,139,170,0.2)] bg-[#09162A] p-[18px] shadow-[0_12px_28px_rgba(0,0,0,0.22)] sm:p-5">
                <AccountSummary summary={data.summary} error={data.summaryError} embedded />
                <div className="mt-6 border-t border-[rgba(76,139,170,0.14)] pt-5">
                  <StoreSelectorLogout />
                </div>
              </div>
            </aside>
          </div>
        </main>
      </div>
    </div>
  );
}
