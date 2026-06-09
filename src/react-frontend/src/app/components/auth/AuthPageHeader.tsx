export function AuthPageHeader() {
  return (
    <header className="w-full flex items-center justify-between px-6 py-4 lg:px-12 border-b border-gray-100 bg-white sticky top-0 z-50 shadow-sm">
      <div className="flex items-center">
        <span className="text-3xl font-extrabold text-[#00b14f] tracking-tight">Organica</span>
      </div>
      <div className="flex items-center gap-6">
        <a
          href="/react/index.html?view=register&seller=1"
          className="text-[14px] lg:text-[15px] font-semibold text-[#006a4e] hover:text-[#00b14f] transition-colors"
        >
          Tìm hiểu <span className="font-normal text-gray-500 hidden sm:inline">trở thành người bán</span>
        </a>
      </div>
    </header>
  );
}