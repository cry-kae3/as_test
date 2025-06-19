const { Store, StoreStaffRequirement, Staff, StaffDayPreference } = require('../models');

async function seedStores() {
    const count = await Store.count();
    if (count > 0) {
        console.log('店舗データは既に存在するため、スキップします。');
        return;
    }
    console.log('店舗の初期データを登録します...');
    const stores = [
        { id: 1, name: '福井本店', address: '福井県福井市下馬3丁目1601', phone: '0776-76-2247', email: 'fukui-honten@example.com', opening_time: '07:00', closing_time: '19:00', owner_id: 1, area: '福井県', postal_code: '918-8112' },
        { id: 2, name: 'くるふ福井駅店', address: '福井県福井市中央1丁目1-25 くるふ福井駅内', phone: null, email: 'kurufu-fukui@example.com', opening_time: '08:30', closing_time: '20:00', owner_id: 1, area: '福井県', postal_code: '910-0006' },
        { id: 3, name: 'MEGAドン・キホーテUNY福井店', address: '福井県福井市飯塚町11-111 MEGAドン・キホーテUNY福井店1F', phone: null, email: 'donki-fukui@example.com', opening_time: '09:00', closing_time: '19:00', owner_id: 1, area: '福井県', postal_code: '918-8067' },
        { id: 4, name: '金沢8号線店', address: '石川県金沢市二ツ屋町10-8', phone: null, email: 'kanazawa-8@example.com', opening_time: '07:00', closing_time: '19:00', owner_id: 1, area: '石川県', postal_code: '920-0065' },
        { id: 5, name: '金沢エムザ店', address: '石川県金沢市武蔵町15-1 金沢エムザ 地階 食品フロア', phone: null, email: 'kanazawa-msa@example.com', opening_time: '10:00', closing_time: '19:00', owner_id: 1, area: '石川県', postal_code: '920-8583' },
        { id: 6, name: '岐阜羽島本店', address: '岐阜県羽島市舟橋町本町5-25', phone: null, email: 'gifu-hashima@example.com', opening_time: '07:00', closing_time: '17:00', owner_id: 1, area: '岐阜県', postal_code: '501-6303' },
        { id: 7, name: '羽島インター店', address: '岐阜県羽島市舟橋町字江北西269-1', phone: null, email: 'hashima-ic@example.com', opening_time: '07:00', closing_time: '19:00', owner_id: 1, area: '岐阜県', postal_code: '501-6302' },
        { id: 8, name: '大垣イオンタウン店', address: '岐阜県大垣市三塚町丹瀬463-1 イオンタウン大垣 EAST 1階 フードコート内', phone: null, email: 'ogaki-aeon@example.com', opening_time: '10:30', closing_time: '18:00', owner_id: 1, area: '岐阜県', postal_code: '503-0808' },
    ];
    await Store.bulkCreate(stores);
    console.log('店舗データの登録が完了しました。');
}

async function seedStaffRequirements() {
    const count = await StoreStaffRequirement.count();
    if (count > 0) {
        console.log('人員要件データは既に存在するため、スキップします。');
        return;
    }
    console.log('人員要件の初期データを登録します...');
    const requirements = [];
    for (let storeId = 1; storeId <= 8; storeId++) {
        for (let day = 0; day < 7; day++) {
            if (day === 6 || day === 0) {
                requirements.push({ store_id: storeId, day_of_week: day, start_time: '10:00', end_time: '14:00', required_staff_count: 3 });
                requirements.push({ store_id: storeId, day_of_week: day, start_time: '14:00', end_time: '18:00', required_staff_count: 2 });
            } else {
                requirements.push({ store_id: storeId, day_of_week: day, start_time: '09:00', end_time: '12:00', required_staff_count: 1 });
                requirements.push({ store_id: storeId, day_of_week: day, start_time: '12:00', end_time: '14:00', required_staff_count: 2 });
                requirements.push({ store_id: storeId, day_of_week: day, start_time: '14:00', end_time: '18:00', required_staff_count: 1 });
            }
        }
    }
    await StoreStaffRequirement.bulkCreate(requirements);
    console.log('人員要件データの登録が完了しました。');
}

async function seedStaff() {
    const count = await Staff.count();
    if (count > 0) {
        console.log('スタッフデータは既に存在するため、スキップします。');
        return;
    }
    console.log('スタッフの初期データを登録します...');
    const staffData = [
        { store_id: 1, first_name: '太郎', last_name: '田中', furigana: 'タナカタロウ', gender: '男性', position: '正社員', max_hours_per_month: 160, min_hours_per_month: 140, max_hours_per_day: 8, max_consecutive_days: 5 },
        { store_id: 1, first_name: '花子', last_name: '山田', furigana: 'ヤマダハナコ', gender: '女性', position: 'アルバイト', max_hours_per_month: 80, min_hours_per_month: 40, max_hours_per_day: 6, max_consecutive_days: 4 },
        { store_id: 2, first_name: '次郎', last_name: '鈴木', furigana: 'スズキジロウ', gender: '男性', position: '正社員', max_hours_per_month: 160, min_hours_per_month: 140, max_hours_per_day: 8, max_consecutive_days: 5 },
        { store_id: 2, first_name: '美咲', last_name: '高橋', furigana: 'タカハシミサキ', gender: '女性', position: 'パート', max_hours_per_month: 100, min_hours_per_month: 60, max_hours_per_day: 7, max_consecutive_days: 5 },
        { store_id: 3, first_name: '三郎', last_name: '佐藤', furigana: 'サトウサブロウ', gender: '男性', position: 'アルバイト', max_hours_per_month: 80, min_hours_per_month: 0, max_hours_per_day: 8, max_consecutive_days: 3 },
        { store_id: 4, first_name: '愛', last_name: '伊藤', furigana: 'イトウアイ', gender: '女性', position: '正社員', max_hours_per_month: 150, min_hours_per_month: 120, max_hours_per_day: 8, max_consecutive_days: 5 },
        { store_id: 5, first_name: '健太', last_name: '渡辺', furigana: 'ワタナベケンタ', gender: '男性', position: 'パート', max_hours_per_month: 120, min_hours_per_month: 80, max_hours_per_day: 8, max_consecutive_days: 5 },
        { store_id: 6, first_name: 'さくら', last_name: '山本', furigana: 'ヤマモトサクラ', gender: '女性', position: 'アルバイト', max_hours_per_month: 90, min_hours_per_month: 50, max_hours_per_day: 5, max_consecutive_days: 4 },
        { store_id: 7, first_name: '大輔', last_name: '中村', furigana: 'ナカムラダイスケ', gender: '男性', position: '店長', max_hours_per_month: 180, min_hours_per_month: 160, max_hours_per_day: 10, max_consecutive_days: 6 },
        { store_id: 8, first_name: '陽子', last_name: '小林', furigana: 'コバヤシヨウコ', gender: '女性', position: 'パート', max_hours_per_month: 100, min_hours_per_month: 40, max_hours_per_day: 6, max_consecutive_days: 5 },
    ];
    const staff = await Staff.bulkCreate(staffData);

    const preferences = [];
    staff.forEach(s => {
        for (let day = 1; day <= 5; day++) {
            preferences.push({ staff_id: s.id, day_of_week: day, available: true, preferred_start_time: '09:00', preferred_end_time: '17:00' });
        }
        preferences.push({ staff_id: s.id, day_of_week: 6, available: true, preferred_start_time: '10:00', preferred_end_time: '18:00' });
        preferences.push({ staff_id: s.id, day_of_week: 0, available: false });
    });
    await StaffDayPreference.bulkCreate(preferences);

    console.log('スタッフの初期データ登録が完了しました。');
}


const seedDatabase = async () => {
    await seedStores();
    await seedStaffRequirements();
    await seedStaff();
}

module.exports = {
    seedDatabase,
};