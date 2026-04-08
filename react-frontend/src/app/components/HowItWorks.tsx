import { Search, ShoppingCart, Home } from 'lucide-react';

const steps = [
	{
		icon: Search,
		number: '01',
		title: 'Chọn sản phẩm',
		description: 'Duyệt và chọn sản phẩm yêu thích từ danh mục đa dạng',
	},
	{
		icon: ShoppingCart,
		number: '02',
		title: 'Đặt hàng',
		description: 'Thêm vào giỏ hàng và thanh toán dễ dàng, an toàn',
	},
	{
		icon: Home,
		number: '03',
		title: 'Nhận hàng',
		description: 'Giao hàng tận nhà trong 2 giờ, tươi sống như vừa mua',
	},
];

export function HowItWorks() {
	return (
		<section className="py-16 bg-white">
			<div className="container mx-auto px-4">
				<div className="text-center mb-12">
					<h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
						Cách thức hoạt động
					</h2>
					<p className="text-gray-600 max-w-2xl mx-auto">
						Chỉ với 3 bước đơn giản, bạn có thể tận hưởng thực phẩm tươi ngon tại
						nha
					</p>
				</div>

				<div className="grid md:grid-cols-3 gap-8 relative">
					{/* Connecting lines */}
					<div className="hidden md:block absolute top-16 left-1/6 right-1/6 h-0.5 bg-gradient-to-r from-green-200 via-green-400 to-green-200"></div>

					{steps.map((step, index) => {
						const Icon = step.icon;
						return (
							<div key={index} className="relative text-center">
								<div className="relative inline-block mb-6">
									<div className="bg-green-600 text-white size-24 rounded-full flex items-center justify-center mx-auto shadow-lg relative z-10">
										<Icon className="size-10" />
									</div>
									<div className="absolute -top-2 -right-2 bg-yellow-400 text-gray-900 size-10 rounded-full flex items-center justify-center font-bold text-sm shadow-md z-20">
										{step.number}
									</div>
								</div>
								<h3 className="text-xl font-bold text-gray-900 mb-2">
									{step.title}
								</h3>
								<p className="text-gray-600">{step.description}</p>
							</div>
						);
					})}
				</div>
			</div>
		</section>
	);
}
