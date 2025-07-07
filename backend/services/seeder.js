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

// ランダムに配列から要素を選択するヘルパー関数
function getRandomElements(array, count) {
    const shuffled = [...array].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
}

// ランダムに1〜maxの数値を返すヘルパー関数
function getRandomNumber(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function seedStaff() {
    const count = await Staff.count();
    if (count > 0) {
        console.log('スタッフデータは既に存在するため、スキップします。');
        return;
    }
    console.log('スタッフの初期データを登録します...');

    // 拡張されたスタッフデータ（より多くのスタッフを追加）
    const staffData = [
        { id: 1, store_id: 1, first_name: '太郎', last_name: '田中', furigana: 'タナカタロウ', gender: '男性', position: '正社員', employment_type: '正社員', max_hours_per_month: 160, min_hours_per_month: 140, max_hours_per_day: 8 },
        { id: 2, store_id: 1, first_name: '花子', last_name: '山田', furigana: 'ヤマダハナコ', gender: '女性', position: 'アルバイト', employment_type: 'アルバイト', max_hours_per_month: 80, min_hours_per_month: 40, max_hours_per_day: 6 },
        { id: 3, store_id: 1, first_name: '健一', last_name: '佐藤', furigana: 'サトウケンイチ', gender: '男性', position: 'パート', employment_type: 'パート', max_hours_per_month: 100, min_hours_per_month: 60, max_hours_per_day: 7 },

        { id: 4, store_id: 2, first_name: '次郎', last_name: '鈴木', furigana: 'スズキジロウ', gender: '男性', position: '正社員', employment_type: '正社員', max_hours_per_month: 160, min_hours_per_month: 140, max_hours_per_day: 8 },
        { id: 5, store_id: 2, first_name: '美咲', last_name: '高橋', furigana: 'タカハシミサキ', gender: '女性', position: 'パート', employment_type: 'パート', max_hours_per_month: 100, min_hours_per_month: 60, max_hours_per_day: 7 },
        { id: 6, store_id: 2, first_name: '雅人', last_name: '伊藤', furigana: 'イトウマサト', gender: '男性', position: 'アルバイト', employment_type: 'アルバイト', max_hours_per_month: 70, min_hours_per_month: 30, max_hours_per_day: 5 },

        { id: 7, store_id: 3, first_name: '三郎', last_name: '佐藤', furigana: 'サトウサブロウ', gender: '男性', position: 'アルバイト', employment_type: 'アルバイト', max_hours_per_month: 80, min_hours_per_month: 0, max_hours_per_day: 8 },
        { id: 8, store_id: 3, first_name: '由美', last_name: '渡辺', furigana: 'ワタナベユミ', gender: '女性', position: 'パート', employment_type: 'パート', max_hours_per_month: 90, min_hours_per_month: 50, max_hours_per_day: 6 },

        { id: 9, store_id: 4, first_name: '愛', last_name: '伊藤', furigana: 'イトウアイ', gender: '女性', position: '正社員', employment_type: '正社員', max_hours_per_month: 150, min_hours_per_month: 120, max_hours_per_day: 8 },
        { id: 10, store_id: 4, first_name: '翔太', last_name: '中島', furigana: 'ナカジマショウタ', gender: '男性', position: 'アルバイト', employment_type: 'アルバイト', max_hours_per_month: 85, min_hours_per_month: 45, max_hours_per_day: 6 },

        { id: 11, store_id: 5, first_name: '健太', last_name: '渡辺', furigana: 'ワタナベケンタ', gender: '男性', position: 'パート', employment_type: 'パート', max_hours_per_month: 120, min_hours_per_month: 80, max_hours_per_day: 8 },
        { id: 12, store_id: 5, first_name: '麻衣', last_name: '吉田', furigana: 'ヨシダマイ', gender: '女性', position: 'アルバイト', employment_type: 'アルバイト', max_hours_per_month: 75, min_hours_per_month: 35, max_hours_per_day: 5 },

        { id: 13, store_id: 6, first_name: 'さくら', last_name: '山本', furigana: 'ヤマモトサクラ', gender: '女性', position: 'アルバイト', employment_type: 'アルバイト', max_hours_per_month: 90, min_hours_per_month: 50, max_hours_per_day: 5 },
        { id: 14, store_id: 6, first_name: '拓也', last_name: '松本', furigana: 'マツモトタクヤ', gender: '男性', position: 'パート', employment_type: 'パート', max_hours_per_month: 110, min_hours_per_month: 70, max_hours_per_day: 7 },

        { id: 15, store_id: 7, first_name: '大輔', last_name: '中村', furigana: 'ナカムラダイスケ', gender: '男性', position: '店長', employment_type: '正社員', max_hours_per_month: 180, min_hours_per_month: 160, max_hours_per_day: 10 },
        { id: 16, store_id: 7, first_name: '真理', last_name: '小川', furigana: 'オガワマリ', gender: '女性', position: 'パート', employment_type: 'パート', max_hours_per_month: 95, min_hours_per_month: 55, max_hours_per_day: 6 },

        { id: 17, store_id: 8, first_name: '陽子', last_name: '小林', furigana: 'コバヤシヨウコ', gender: '女性', position: 'パート', employment_type: 'パート', max_hours_per_month: 100, min_hours_per_month: 40, max_hours_per_day: 6 },
        { id: 18, store_id: 8, first_name: '隆', last_name: '加藤', furigana: 'カトウタカシ', gender: '男性', position: 'アルバイト', employment_type: 'アルバイト', max_hours_per_month: 80, min_hours_per_month: 40, max_hours_per_day: 7 },
    ];

    await Staff.bulkCreate(staffData);
    console.log('スタッフの基本データ登録が完了しました。');

    // スタッフの勤務可能店舗（staff_stores）の設定
    const staffWorkableStores = [
        // 福井県エリア（店舗1-3）のスタッフは福井県内で勤務可能
        { staffId: 1, storeIds: [1, 2, 3] },      // 田中太郎：福井本店、くるふ福井駅店、ドンキ福井店
        { staffId: 2, storeIds: [1, 2] },         // 山田花子：福井本店、くるふ福井駅店
        { staffId: 3, storeIds: [1, 3] },         // 佐藤健一：福井本店、ドンキ福井店
        { staffId: 4, storeIds: [2, 3] },         // 鈴木次郎：くるふ福井駅店、ドンキ福井店
        { staffId: 5, storeIds: [2] },            // 高橋美咲：くるふ福井駅店のみ
        { staffId: 6, storeIds: [2, 3] },         // 伊藤雅人：くるふ福井駅店、ドンキ福井店
        { staffId: 7, storeIds: [3] },            // 佐藤三郎：ドンキ福井店のみ
        { staffId: 8, storeIds: [1, 3] },         // 渡辺由美：福井本店、ドンキ福井店

        // 石川県エリア（店舗4-5）のスタッフは石川県内で勤務可能
        { staffId: 9, storeIds: [4, 5] },         // 伊藤愛：金沢8号線店、金沢エムザ店
        { staffId: 10, storeIds: [4] },           // 中島翔太：金沢8号線店のみ
        { staffId: 11, storeIds: [4, 5] },        // 渡辺健太：金沢8号線店、金沢エムザ店
        { staffId: 12, storeIds: [5] },           // 吉田麻衣：金沢エムザ店のみ

        // 岐阜県エリア（店舗6-8）のスタッフは岐阜県内で勤務可能
        { staffId: 13, storeIds: [6, 7] },        // 山本さくら：岐阜羽島本店、羽島インター店
        { staffId: 14, storeIds: [6, 7, 8] },     // 松本拓也：岐阜県内全店舗
        { staffId: 15, storeIds: [6, 7, 8] },     // 中村大輔（店長）：岐阜県内全店舗
        { staffId: 16, storeIds: [7, 8] },        // 小川真理：羽島インター店、大垣イオンタウン店
        { staffId: 17, storeIds: [8] },           // 小林陽子：大垣イオンタウン店のみ
        { staffId: 18, storeIds: [7, 8] },        // 加藤隆：羽島インター店、大垣イオンタウン店
    ];

    // 勤務可能店舗の設定
    for (const data of staffWorkableStores) {
        const staff = await Staff.findByPk(data.staffId);
        if (staff) {
            await staff.setStores(data.storeIds);
            console.log(`スタッフ${data.staffId}に店舗${data.storeIds.join(',')}を設定しました。`);
        }
    }
    console.log('スタッフの勤務可能店舗の設定が完了しました。');

    // AI生成対象店舗（staff_ai_generation_stores）の設定 - 各スタッフ1店舗のみ
    console.log('AI生成対象店舗を設定します（各スタッフ1店舗）...');

    const aiGenerationAssignments = [];

    for (const data of staffWorkableStores) {
        const staff = await Staff.findByPk(data.staffId);
        if (!staff) continue;

        // そのスタッフが勤務可能な店舗から、1つだけAI生成対象店舗を選択
        const availableStores = data.storeIds;
        let selectedStore;

        if (staff.employment_type === '正社員' || staff.position === '店長') {
            // 正社員・店長：主要店舗（store_id）を優先的に選択
            selectedStore = availableStores.includes(staff.store_id) ? staff.store_id : availableStores[0];
        } else {
            // パート・アルバイト：ランダムに1店舗を選択
            const randomIndex = Math.floor(Math.random() * availableStores.length);
            selectedStore = availableStores[randomIndex];
        }

        const aiGenerationStores = [selectedStore];

        await staff.setAiGenerationStores(aiGenerationStores);
        console.log(`スタッフ${data.staffId}にAI生成対象店舗${selectedStore}を設定しました。`);

        aiGenerationAssignments.push({
            staffId: data.staffId,
            staffName: `${staff.last_name} ${staff.first_name}`,
            employmentType: staff.employment_type,
            workableStores: availableStores,
            aiGenerationStore: selectedStore
        });
    }

    console.log('AI生成対象店舗の設定が完了しました。');
    console.log('設定内容:');
    aiGenerationAssignments.forEach(assignment => {
        console.log(`  ${assignment.staffName} (${assignment.employmentType}): 勤務可能[${assignment.workableStores.join(',')}] → AI生成[${assignment.aiGenerationStore}]`);
    });

    // 希望シフトの設定（修正版 - Boolean値を明確に設定）
    const staffFromDb = await Staff.findAll();
    const preferences = [];

    staffFromDb.forEach(s => {
        console.log(`\n=== ${s.last_name} ${s.first_name} の希望シフト設定 ===`);

        if (s.employment_type === '正社員' || s.position === '店長') {
            // 正社員・店長：平日中心、土日は一部のみ勤務可能
            for (let day = 1; day <= 5; day++) {
                preferences.push({
                    staff_id: s.id,
                    day_of_week: day,
                    available: true, // 明確にtrueを設定
                    preferred_start_time: '09:00',
                    preferred_end_time: '18:00'
                });
                console.log(`  曜日${day}: available=true (平日勤務)`);
            }
            // 土日はランダムで勤務可能
            const saturdayAvailable = Math.random() > 0.5;
            const sundayAvailable = Math.random() > 0.6;

            preferences.push({
                staff_id: s.id,
                day_of_week: 6, // 土曜日
                available: saturdayAvailable // 明確にBoolean値を設定
            });
            console.log(`  曜日6(土): available=${saturdayAvailable}`);

            preferences.push({
                staff_id: s.id,
                day_of_week: 0, // 日曜日
                available: sundayAvailable // 明確にBoolean値を設定
            });
            console.log(`  曜日0(日): available=${sundayAvailable}`);

        } else {
            // パート・アルバイト：より柔軟な勤務パターン
            for (let day = 0; day < 7; day++) {
                const isWeekend = day === 0 || day === 6;
                const availability = isWeekend ? Math.random() > 0.3 : Math.random() > 0.2;

                if (availability) {
                    // 勤務可能な場合の時間帯をランダムに設定
                    const startHours = [9, 10, 11, 12, 13, 14];
                    const endHours = [15, 16, 17, 18, 19];

                    const startHour = startHours[Math.floor(Math.random() * startHours.length)];
                    const endHour = endHours[Math.floor(Math.random() * endHours.length)];

                    // 終了時間が開始時間より後になるように調整
                    const finalEndHour = Math.max(endHour, startHour + 3);

                    preferences.push({
                        staff_id: s.id,
                        day_of_week: day,
                        available: true, // 明確にtrueを設定
                        preferred_start_time: `${String(startHour).padStart(2, '0')}:00`,
                        preferred_end_time: `${String(finalEndHour).padStart(2, '0')}:00`
                    });
                    console.log(`  曜日${day}: available=true (${startHour}:00-${finalEndHour}:00)`);
                } else {
                    preferences.push({
                        staff_id: s.id,
                        day_of_week: day,
                        available: false // 明確にfalseを設定
                    });
                    console.log(`  曜日${day}: available=false`);
                }
            }
        }
    });

    console.log(`\n希望シフトデータを一括登録します（${preferences.length}件）...`);

    // Boolean値の検証ログ
    preferences.forEach((pref, index) => {
        if (index < 10) { // 最初の10件のみログ出力
            console.log(`検証 - Staff ${pref.staff_id}, Day ${pref.day_of_week}: available=${pref.available} (type: ${typeof pref.available})`);
        }
    });

    await StaffDayPreference.bulkCreate(preferences);
    console.log('スタッフの希望シフト登録が完了しました。');

    // 登録後の検証
    const savedPreferences = await StaffDayPreference.findAll({
        where: { staff_id: [4, 5] }, // テスト対象のスタッフのみ
        order: [['staff_id', 'ASC'], ['day_of_week', 'ASC']]
    });

    console.log('\n=== 登録後の検証（スタッフ4, 5のみ） ===');
    savedPreferences.forEach(pref => {
        console.log(`Staff ${pref.staff_id}, Day ${pref.day_of_week}: available=${pref.available} (type: ${typeof pref.available})`);
    });
}

const seedDatabase = async () => {
    await seedStores();
    await seedStaffRequirements();
    await seedStaff();
}

module.exports = {
    seedDatabase,
};