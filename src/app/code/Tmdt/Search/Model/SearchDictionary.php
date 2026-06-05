<?php

declare(strict_types=1);

namespace Tmdt\Search\Model;

class SearchDictionary
{
    /**
     * Keep this list domain-focused and conservative: each group expands common
     * user terms into food/grocery variants without becoming too noisy.
     */
    private const GROUPS = [
        ['gạo', 'gạo trắng', 'gạo thơm', 'gạo tẻ', 'gạo nếp', 'cơm', 'rice'],
        ['gạo st25', 'st25', 'gạo thơm st25', 'gạo đặc sản'],
        ['gạo lứt', 'gạo lức', 'gạo lứt đỏ', 'gạo nguyên cám'],
        ['nếp', 'gạo nếp', 'nếp cái hoa vàng', 'xôi'],
        ['bún', 'bún gạo', 'bún khô', 'bún tươi', 'bún ăn liền'],
        ['miến', 'miến dong', 'miến khô', 'miến gạo'],
        ['phở', 'bánh phở', 'phở khô', 'phở tươi'],
        ['nui', 'mì nui', 'pasta', 'mì ống'],
        ['mì', 'mỳ', 'mì gói', 'mì trứng', 'noodle'],
        ['bột', 'bột mì', 'bột gạo', 'bột năng', 'bột chiên'],
        ['bột mì', 'wheat flour', 'bột làm bánh', 'bột bánh mì'],
        ['bột gạo', 'rice flour', 'bột bánh cuốn', 'bột bánh xèo'],
        ['bột năng', 'tinh bột sắn', 'tapioca starch'],
        ['dầu ăn', 'dầu thực vật', 'dầu đậu nành', 'dầu hướng dương'],
        ['nước mắm', 'mắm', 'nước chấm', 'fish sauce'],
        ['nước tương', 'xì dầu', 'soy sauce', 'tương đậu nành'],
        ['tương ớt', 'sốt ớt', 'chili sauce', 'sa tế'],
        ['đường', 'đường trắng', 'đường cát', 'đường vàng', 'đường phèn'],
        ['muối', 'muối biển', 'muối hạt', 'muối tinh', 'bột canh'],
        ['hạt nêm', 'bột nêm', 'gia vị nêm', 'seasoning'],
        ['tiêu', 'hạt tiêu', 'tiêu đen', 'tiêu xay', 'pepper'],
        ['tỏi', 'tỏi ta', 'tỏi băm', 'tỏi phi', 'garlic'],
        ['hành', 'hành tím', 'hành lá', 'hành tây', 'hành khô'],
        ['rau', 'rau xanh', 'rau ăn lá', 'rau tươi', 'vegetable'],
        ['rau muống', 'rau xanh', 'rau luộc', 'rau xào'],
        ['cải', 'rau cải', 'cải xanh', 'cải ngọt', 'cải thìa'],
        ['xà lách', 'rau xà lách', 'salad', 'lettuce'],
        ['cà chua', 'tomato', 'cà chua ta', 'cà chua bi'],
        ['khoai tây', 'potato', 'củ khoai tây'],
        ['cà rốt', 'carrot', 'củ cà rốt'],
        ['dưa leo', 'dưa chuột', 'cucumber'],
        ['nấm', 'nấm tươi', 'nấm rơm', 'nấm kim châm', 'nấm đông cô'],
        ['trái cây', 'hoa quả', 'quả tươi', 'fruit'],
        ['chuối', 'banana', 'chuối già', 'chuối tiêu'],
        ['cam', 'orange', 'cam sành', 'cam tươi'],
        ['táo', 'apple', 'táo đỏ', 'táo nhập khẩu'],
        ['thịt heo', 'thịt lợn', 'heo', 'lợn', 'pork', 'ba chỉ', 'ba rọi', 'sườn heo', 'nạc vai'],
        ['ba chỉ', 'ba rọi', 'thịt ba chỉ', 'pork belly'],
        ['sườn heo', 'sườn non', 'sườn cốt lết', 'pork rib'],
        ['thịt bò', 'bò', 'bò bê', 'beef', 'nạm bò', 'bắp bò', 'thăn bò'],
        ['thịt gà', 'gà', 'chicken', 'đùi gà', 'ức gà', 'cánh gà'],
        ['trứng', 'trứng gà', 'trứng vịt', 'egg'],
        ['thịt vịt', 'vịt', 'duck', 'vịt làm sẵn'],
        ['hải sản', 'thủy hải sản', 'seafood', 'đồ biển'],
        ['cá', 'fish', 'cá tươi', 'cá phi lê', 'cá hồi'],
        ['tôm', 'shrimp', 'tôm sú', 'tôm thẻ', 'tôm tươi'],
        ['mực', 'squid', 'mực ống', 'mực tươi'],
        ['cua', 'crab', 'cua biển', 'cua đồng'],
        ['cá viên', 'bò viên', 'viên thả lẩu', 'thực phẩm đông lạnh'],
        ['xúc xích', 'lạp xưởng', 'sausage', 'xúc xích hun khói'],
        ['hạt điều', 'hạt khô', 'đậu phộng', 'hạnh nhân', 'óc chó'],
    ];

    public function expand(array $terms): array
    {
        $expanded = $terms;
        $normalizedInput = array_map(fn (string $term): string => $this->normalize($term), $terms);

        foreach (self::GROUPS as $group) {
            $normalizedGroup = array_map(fn (string $term): string => $this->normalize($term), $group);
            $matched = false;
            foreach ($normalizedInput as $input) {
                if ($input === '' || mb_strlen($input, 'UTF-8') < 3) {
                    continue;
                }
                foreach ($normalizedGroup as $groupTerm) {
                    if ($groupTerm !== '' && (
                        str_contains($input, $groupTerm)
                        || (mb_strlen($input, 'UTF-8') >= 4 && str_contains($groupTerm, $input))
                    )) {
                        $matched = true;
                        break 2;
                    }
                }
            }

            if ($matched) {
                array_push($expanded, ...$group);
            }
        }

        return $this->dedupe($expanded);
    }

    public function normalize(string $value): string
    {
        $value = mb_strtolower(trim($value), 'UTF-8');
        $value = str_replace(['đ', 'Đ'], ['d', 'd'], $value);
        $ascii = @iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $value);
        if (is_string($ascii) && $ascii !== '') {
            $value = $ascii;
        }
        $value = preg_replace('/[^a-z0-9\s_-]+/u', ' ', $value) ?? $value;
        $value = preg_replace('/\s+/', ' ', $value) ?? $value;

        return trim($value);
    }

    public function dedupe(array $terms): array
    {
        $seen = [];
        $result = [];
        foreach ($terms as $term) {
            $term = trim((string) $term);
            if ($term === '') {
                continue;
            }
            $key = $this->normalize($term);
            if ($key === '' || isset($seen[$key])) {
                continue;
            }
            $seen[$key] = true;
            $result[] = $term;
        }

        return $result;
    }
}
