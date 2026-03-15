import { Shop } from './types';

export const INITIAL_SHOPS: Shop[] = [
  // B1F
  { store_id: 's001', name: 'サカバダ アレグロ', floor: 'B1F' },
  { store_id: 's002', name: '地酒蔵 大阪 JIZAKE KURA OSAKA', floor: 'B1F' },
  { store_id: 's003', name: '韓国酒場コッキオ＋サムギョプサル', floor: 'B1F' },
  { store_id: 's004', name: '揚げたてねりもん おでんのじんべえ', floor: 'B1F' },
  { store_id: 's005', name: '板前焼肉 一笑', floor: 'B1F' },
  { store_id: 's006', name: 'ゴールデン タイガー', floor: 'B1F' },
  { store_id: 's007', name: '権之介 梅田', floor: 'B1F' },
  { store_id: 's008', name: '博多もつ鍋 おおやま', floor: 'B1F' },
  { store_id: 's009', name: '酒友 はなび', floor: 'B1F' },
  { store_id: 's010', name: '串カツ田中', floor: 'B1F' },
  { store_id: 's011', name: 'daily dose coffee', floor: 'B1F' },
  { store_id: 's012', name: 'めっちゃAbuRu yan', floor: 'B1F' },
  { store_id: 's013', name: 'LEMONADE DISCO', floor: 'B1F' },
  { store_id: 's014', name: 'メディアカフェポパイ', floor: 'B1F' },
  // 1F
  { store_id: 's015', name: 'すすきの大衆酒場 白いたぬきホール', floor: '1F' },
  { store_id: 's016', name: '幻想の国のアリス', floor: '1F' },
  { store_id: 's017', name: '薩摩ごかもん', floor: '1F' },
  { store_id: 's018', name: '新阪急ホテルアネックス（カフェ・クレール）', floor: '1F' },
  { store_id: 's019', name: 'えびそば 一幻', floor: '1F' },
  // 2F
  { store_id: 's020', name: 'BIG ECHO', floor: '2F' },
  { store_id: 's021', name: '大衆酒場 ボナパルト・ブルー', floor: '2F' },
  { store_id: 's022', name: '大衆酒場 どんがめ（2階店）', floor: '2F' },
  { store_id: 's023', name: '鳥貴族', floor: '2F' },
  { store_id: 's024', name: 'ANDRE', floor: '2F' },
  { store_id: 's025', name: '海鮮屋台おくまん', floor: '2F' },
  { store_id: 's026', name: 'FreeEntertainmentSpace [fés]', floor: '2F' },
  { store_id: 's027', name: 'Bar moonwalk', floor: '2F' },
  // 3F
  { store_id: 's028', name: '忘我スタジアム', floor: '3F' },
  { store_id: 's029', name: '恋愛酒場メイ子', floor: '3F' },
  { store_id: 's030', name: '大衆酒場 どんがめ（3階店）', floor: '3F' },
  { store_id: 's031', name: 'エッジオリジネーション/エッジアイ', floor: '3F' },
];

export const INITIAL_PRIZES: import('./types').Prize[] = [
  { prize_id: 'p1', name: '1等', order: 1 },
  { prize_id: 'p2', name: '2等', order: 2 },
  { prize_id: 'p3', name: 'ラッキー賞', order: 3 },
];
