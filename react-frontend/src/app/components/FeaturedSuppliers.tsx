import { useMemo, useState } from 'react';
import { ChevronRight, Store, Package, Award } from 'lucide-react';

const suppliers = [
	{
		name: 'Rau Sạch Ngân Giang',
		logo: '🥬',
		category: 'Rau củ quả',
		stats: {
			customers: 5,
			products: 114,
			branches: '10+',
		},
		badges: ['ATTP', 'VietGap'],
	},
	{
		name: 'Rau Huy Hùng',
		logo: '🌿',
		category: 'Rau củ quả, Trái cây',
		stats: {
			customers: 24,
			products: 115,
			branches: '99+',
		},
		badges: ['ATTP'],
	},
	{
		name: 'Thái Eco',
		logo: '🌱',
		category: 'Rau củ quả',
		stats: {
			customers: 11,
			products: 83,
			branches: '20+',
		},
		badges: ['ATTP', 'VietGap'],
	},
	{
		name: 'Organic Farm',
		logo: '🍃',
		category: 'Rau củ quả, Trái cây',
		stats: {
			customers: 18,
			products: 92,
			branches: '15+',
		},
		badges: ['ATTP', 'VietGap'],
	},
];

export function FeaturedSuppliers() {
	const suppliersPerPage = 3;
	const [page, setPage] = useState(0);

	const totalPages = Math.ceil(suppliers.length / suppliersPerPage);
	const visibleSuppliers = useMemo(() => {
		const start = page * suppliersPerPage;
		return suppliers.slice(start, start + suppliersPerPage);
	}, [page]);

	const handleNext = () => {
		setPage((prev) => (prev + 1) % totalPages);
	};

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
				</div>

				{/* Suppliers Carousel */}
				<div className="relative">
					{/* Navigation Arrows */}
					<button
						onClick={handleNext}
						className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 z-10 bg-white rounded-full p-2 shadow-lg hover:bg-gray-50 transition-colors"
						aria-label="Xem thêm nhà cung cấp"
					>
						<ChevronRight className="size-6 text-gray-600" />
					</button>

					{/* Suppliers Grid */}
					<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
						{visibleSuppliers.map((supplier, index) => (
							<div
								key={`${supplier.name}-${index}`}
								className="bg-white rounded-2xl shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden group cursor-pointer border border-gray-100"
							>
								{/* Decorative Top Border */}
								<div className="h-2 bg-gradient-to-r from-green-400 via-blue-400 to-green-400"></div>

								{/* Logo Section */}
								<div className="flex justify-center pt-6 pb-4">
									<div className="size-20 bg-gradient-to-br from-green-100 to-green-50 rounded-2xl flex items-center justify-center border-2 border-green-200 group-hover:scale-110 transition-transform duration-300">
										<span className="text-4xl">{supplier.logo}</span>
									</div>
								</div>

								{/* Supplier Info */}
								<div className="px-6 pb-6 text-center">
									<h3 className="font-bold text-gray-900 mb-1 group-hover:text-green-600 transition-colors">
										{supplier.name} <ChevronRight className="inline-block size-4" />
									</h3>
									<p className="text-xs text-gray-600 mb-4">
										Dòng sản phẩm chính:
										<br />
										<span className="font-medium text-gray-700">{supplier.category}</span>
									</p>

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
			</div>
		</section>
	);
}
