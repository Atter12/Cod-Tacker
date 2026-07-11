"use client";

export function GoogleLoginPlaceholder() {
  return (
    <div className="space-y-2">
      <button
        type="button"
        aria-disabled="true"
        title="Google OAuth estará disponible próximamente"
        onClick={(event) => {
          event.preventDefault();
        }}
        className="flex h-11 w-full cursor-not-allowed items-center justify-center gap-2.5 rounded-[11px] border border-[rgba(76,139,170,0.28)] bg-[#0B1A2C] text-[14px] font-medium text-[#F8FAFC] transition-colors duration-150 hover:border-[rgba(76,139,170,0.4)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(34,211,238,0.45)]"
      >
        <GoogleMark />
        <span>Continuar con Google</span>
        <span className="ml-1 rounded-full border border-[rgba(76,139,170,0.35)] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[#94A3B8]">
          Próximamente
        </span>
      </button>
    </div>
  );
}

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M9 7.4v3.3h4.6c-.2 1.1-.8 2-1.7 2.6l2.7 2.1c1.6-1.5 2.5-3.7 2.5-6.3 0-.6-.1-1.2-.2-1.7H9z"
      />
      <path
        fill="#34A853"
        d="M4.1 10.7a5.4 5.4 0 0 1 0-3.4L1.3 5.1a9 9 0 0 0 0 7.8l2.8-2.2z"
      />
      <path
        fill="#4A90E2"
        d="M9 17c2.4 0 4.4-.8 5.9-2.1l-2.7-2.1c-.8.5-1.8.9-3.2.9a5.4 5.4 0 0 1-5.1-3.7l-2.8 2.2A9 9 0 0 0 9 17z"
      />
      <path
        fill="#FBBC05"
        d="M9 1.8c1.3 0 2.5.5 3.4 1.3l2.5-2.5A9 9 0 0 0 1.3 5.1l2.8 2.2A5.4 5.4 0 0 1 9 1.8z"
      />
    </svg>
  );
}
