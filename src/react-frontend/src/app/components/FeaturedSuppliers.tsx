import { useMemo, useState, useEffect } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Store,
  Package,
  Award,
  Sprout,
  Leaf,
  Warehouse,
  Fish,
  Flame,
  Egg,
  Beef,
  Apple
} from 'lucide-react';

interface SupplierStats {
	customers: number;
	products: number;
	branches: number | string;
}

interface Supplier {
	id?: number;
	name: string;
	logo: string;
	category: string;
	stats: SupplierStats;
	badges: string[];
}

export function renderSupplierLogo(logoCode: string, className = "size-10") {
  const code = String(logoCode || '').toLowerCase();
  switch (code) {
    case 'cabbage':
      return <Sprout className={`${className} text-emerald-600`} />;
    case 'herb':
      return <Leaf className={`${className} text-green-600`} />;
    case 'sprout':
      return <Sprout className={`${className} text-lime-600`} />;
    case 'leaf':
      return <Leaf className={`${className} text-teal-600`} />;
    case 'broccoli':
      return <Sprout className={`${className} text-emerald-700`} />;
    case 'store':
      return <Warehouse className={`${className} text-blue-600`} />;
    case 'fish':
      return <Fish className={`${className} text-cyan-600`} />;
    case 'meat':
      return <Beef className={`${className} text-red-600`} />;
    case 'chili':
      return <Flame className={`${className} text-orange-600`} />;
    case 'avocado':
      return <Apple className={`${className} text-green-700`} />;
    case 'orange':
      return <Apple className={`${className} text-amber-600`} />;
    case 'egg':
      return <Egg className={`${className} text-yellow-600`} />;
    default:
      return <Store className={`${className} text-slate-600`} />;
  }
}

export function FeaturedSuppliers() {
	const suppliersPerPage = 4;
	const [page, setPage] = useState(0);
	const [suppliers, setSuppliers] = useState<Supplier[]>([]);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		const fetchSuppliers = async () => {
			try {
				const response = await fetch('/rest/V1/tmdt-catalog/suppliers', {
					method: 'GET',
					cache: 'no-store'
				});
				if (response.ok) {
					const json = await response.json();
					let items: Supplier[] = [];
					if (Array.isArray(json)) {
						if (json[0] === true && Array.isArray(json[1])) {
							items = json[1];
						} else {
							items = json;
						}
					} else if (json && Array.isArray(json.items)) {
						items = json.items;
					}
					if (items && items.length > 0) {
						setSuppliers(items);
					}
				}
			} catch (err) {
				console.error('[Suppliers] Failed to fetch B2B suppliers:', err);
			} finally {
				setLoading(false);
			}
		};
		void fetchSuppliers();
	}, []);

	const totalPages = Math.ceil(suppliers.length / suppliersPerPage);
	const visibleSuppliers = useMemo(() => {
		const start = page * suppliersPerPage;
		return suppliers.slice(start, start + suppliersPerPage);
	}, [page, suppliers]);

	const handlePrevPage = () => {
		if (page > 0) setPage(page - 1);
	};

	const handleNextPage = () => {
		if (page < totalPages - 1) setPage(page + 1);
	};

	const handleSupplierClick = (supplier: Supplier) => {
		const sId = supplier.id;
		if (sId) {
			window.location.href = `/react/index.html?view=supplier-detail&supplierId=${sId}&supplierName=${encodeURIComponent(supplier.name)}`;
		}
	};

	if (loading) {
		return (
			<section className="py-8 bg-gradient-to-br from-green-50 via-white to-blue-50">
				<div className="container mx-auto px-4">
					<div className="flex items-center justify-between mb-6">
						<h2 className="text-2xl font-bold">
							Khám phá{' '}
							<span className="text-red-500">nhà cung cấp</span>{' '}
							<span className="text-blue-600">dành riêng</span> cho bạn!
						</h2>
					</div>
					<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
						{[...Array(4)].map((_, i) => (
							<div
								key={i}
								className="bg-white rounded-2xl p-6 border border-gray-100 animate-pulse h-[350px] flex flex-col justify-between"
							>
								<div className="flex flex-col items-center">
									<div className="size-20 bg-gray-100 rounded-2xl mb-4"></div>
									<div className="h-5 bg-gray-100 w-3/4 rounded-md mb-2"></div>
									<div className="h-3 bg-gray-100 w-1/2 rounded-md"></div>
								</div>
								<div className="space-y-3">
									<div className="h-12 bg-gray-100 rounded-md"></div>
									<div className="h-6 bg-gray-100 w-2/3 rounded-full mx-auto"></div>
								</div>
							</div>
						))}
					</div>
				</div>
			</section>
		);
	}

	if (suppliers.length === 0) {
		return null;
	}

	return (
		<section className="py-8 bg-gradient-to-br from-green-50 via-white to-blue-50">
			<div className="container mx-auto px-4">
				{/* Header */}
				<div className="flex items-center justify-between mb-6">
					<h2 className="text-2xl font-bold">
						Khám phá{' '}
						<span className="text-red-500">nhà cung cấp</span>{' '}
						<span className="text-blue-600">dành riêng</span> cho bạn!
					</h2>
					{totalPages > 1 && (
						<div className="flex items-center gap-2">
							<button
								onClick={handlePrevPage}
								disabled={page === 0}
								className="size-10 rounded-full border border-gray-200 bg-white flex items-center justify-center text-gray-600 hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-200 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-xs"
								aria-label="Previous suppliers"
							>
								<ChevronLeft className="size-5" />
							</button>
							<button
								onClick={handleNextPage}
								disabled={page === totalPages - 1}
								className="size-10 rounded-full border border-gray-200 bg-white flex items-center justify-center text-gray-600 hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-200 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-xs"
								aria-label="Next suppliers"
							>
								<ChevronRight className="size-5" />
							</button>
						</div>
					)}
				</div>

				{/* Suppliers Grid */}
				<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
					{visibleSuppliers.map((supplier, index) => (
						<div
							key={`${supplier.name}-${index}`}
							onClick={() => handleSupplierClick(supplier)}
							className="bg-white rounded-2xl shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden group cursor-pointer border border-gray-100 flex flex-col justify-between"
						>
							<div>
								{/* Decorative Top Border */}
								<div className="h-2 bg-gradient-to-r from-green-400 via-blue-400 to-green-400"></div>

								{/* Logo Section */}
								<div className="flex justify-center pt-6 pb-4">
									<div className="size-20 bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl flex items-center justify-center border-2 border-emerald-100 group-hover:scale-110 transition-transform duration-300 shadow-xs">
										{renderSupplierLogo(supplier.logo, "size-10")}
									</div>
								</div>

								{/* Supplier Info */}
								<div className="px-6 pb-4 text-center">
									<h3 className="font-bold text-gray-900 mb-1 group-hover:text-green-600 transition-colors flex items-center justify-center gap-1">
										{supplier.name} <ChevronRight className="size-4 shrink-0" />
									</h3>
									<p className="text-xs text-gray-600 mb-4">
										Dòng sản phẩm chính:
										<br />
										<span className="font-medium text-gray-700">{supplier.category}</span>
									</p>
								</div>
							</div>

							<div className="px-6 pb-6 text-center">
								{/* Stats */}
								<div className="grid grid-cols-3 gap-2 mb-4 py-3 border-t border-b border-gray-100">
									<div>
										<div className="flex justify-center mb-1">
											<Store className="size-4 text-gray-400" />
										</div>
										<p className="text-lg font-bold text-gray-900">{supplier.stats.customers}</p>
										<p className="text-xs text-gray-500">khách hàng</p>
									</div>
									<div>
										<div className="flex justify-center mb-1">
											<Package className="size-4 text-gray-400" />
										</div>
										<p className="text-lg font-bold text-gray-900">{supplier.stats.products}</p>
										<p className="text-xs text-gray-500">sản phẩm</p>
									</div>
									<div>
										<div className="flex justify-center mb-1">
											<Award className="size-4 text-gray-400" />
										</div>
										<p className="text-lg font-bold text-gray-900">{supplier.stats.branches}</p>
										<p className="text-xs text-gray-500">đơn hàng</p>
									</div>
								</div>

								{/* Badges */}
								<div className="flex justify-center gap-2">
									{supplier.badges.map((badge, idx) => (
										<span
											key={idx}
											className="px-3 py-1 bg-blue-50 text-blue-700 text-xs font-medium rounded-full border border-blue-200"
										>
											{badge}
										</span>
									))}
								</div>
							</div>
						</div>
					))}
				</div>
			</div>
		</section>
	);
}
