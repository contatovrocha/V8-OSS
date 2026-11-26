/** Cockpit Comercial da E-commerce Million: página estática em public/comercial, na mesma origem (usa a sessão do Supabase do sistema). */
export default function ComercialPage() {
  return (
    <div className="-mx-4 lg:-mx-6 -mt-6 -mb-28 lg:-mb-10">
      <iframe
        title="Cockpit Comercial"
        src={`${import.meta.env.BASE_URL}comercial/index.html`}
        className="block w-full border-0 bg-black"
        style={{ height: 'calc(100dvh - 64px)' }}
      />
    </div>
  )
}
