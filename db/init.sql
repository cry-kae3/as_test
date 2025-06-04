CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    company_name VARCHAR(255),
    role VARCHAR(50) NOT NULL,
    parent_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_token VARCHAR(255) NOT NULL UNIQUE,
    expires_at TIMESTAMP NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    user_agent TEXT,
    ip_address VARCHAR(45),
    last_activity TIMESTAMP NOT NULL DEFAULT NOW(),
    "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sessions_token ON sessions(session_token);
CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_expires ON sessions(expires_at);
CREATE INDEX idx_sessions_active ON sessions(is_active);

CREATE TABLE stores (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    address TEXT,
    phone VARCHAR(20),
    email VARCHAR(255),
    opening_time TIME NOT NULL,
    closing_time TIME NOT NULL,
    owner_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    area VARCHAR(100),
    postal_code VARCHAR(20),
    "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE store_closed_days (
    id SERIAL PRIMARY KEY,
    store_id INTEGER NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    day_of_week INTEGER,
    specific_date DATE,
    "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT check_day_specification CHECK (
        (day_of_week IS NOT NULL AND specific_date IS NULL) OR 
        (day_of_week IS NULL AND specific_date IS NOT NULL)
    )
);

CREATE TABLE store_staff_requirements (
    id SERIAL PRIMARY KEY,
    store_id INTEGER NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    day_of_week INTEGER,
    specific_date DATE,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    required_staff_count INTEGER NOT NULL,
    "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT check_day_specification CHECK (
        (day_of_week IS NOT NULL AND specific_date IS NULL) OR 
        (day_of_week IS NULL AND specific_date IS NOT NULL)
    )
);

CREATE TABLE staff (
    id SERIAL PRIMARY KEY,
    store_id INTEGER NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    furigana VARCHAR(100),
    gender VARCHAR(10),
    position VARCHAR(50),
    employment_type VARCHAR(20),
    max_hours_per_month INTEGER,
    min_hours_per_month INTEGER,
    max_hours_per_day INTEGER,
    max_consecutive_days INTEGER,
    "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE staff_day_preferences (
    id SERIAL PRIMARY KEY,
    staff_id INTEGER NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
    day_of_week INTEGER NOT NULL,
    available BOOLEAN NOT NULL DEFAULT true,
    preferred_start_time TIME,
    preferred_end_time TIME,
    break_start_time TIME,
    break_end_time TIME,
    "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE staff_day_off_requests (
    id SERIAL PRIMARY KEY,
    staff_id INTEGER NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    reason VARCHAR(255),
    status VARCHAR(20) DEFAULT 'pending',
    "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE shifts (
    id SERIAL PRIMARY KEY,
    store_id INTEGER NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    year INTEGER NOT NULL,
    month INTEGER NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(store_id, year, month)
);

CREATE TABLE shift_assignments (
    id SERIAL PRIMARY KEY,
    shift_id INTEGER NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
    staff_id INTEGER NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    break_start_time TIME,
    break_end_time TIME,
    notes TEXT,
    "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE shift_change_logs (
    id SERIAL PRIMARY KEY,
    shift_assignment_id INTEGER REFERENCES shift_assignments(id) ON DELETE SET NULL,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    change_type VARCHAR(20) NOT NULL,
    previous_data JSONB,
    new_data JSONB,
    change_reason TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE business_hours (
    id SERIAL PRIMARY KEY,
    store_id INTEGER NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    day_of_week INTEGER NOT NULL,
    is_closed BOOLEAN DEFAULT false,
    opening_time TIME,
    closing_time TIME,
    "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE user_change_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    admin_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    change_type VARCHAR(20) NOT NULL,
    field_changed VARCHAR(50) NOT NULL,
    previous_value TEXT,
    new_value TEXT,
    change_reason TEXT,
    impersonation_mode BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE staff_stores (
    id SERIAL PRIMARY KEY,
    staff_id INTEGER NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
    store_id INTEGER NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(staff_id, store_id)
);

CREATE TABLE system_settings (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    closing_day INTEGER NOT NULL DEFAULT 25,
    timezone VARCHAR(50) DEFAULT 'Asia/Tokyo',
    additional_settings JSONB,
    "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(user_id)
);

INSERT INTO users (username, password, email, company_name, role, parent_user_id, is_active, "createdAt", "updatedAt") VALUES
('owner1', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'owner1@example.com', '株式会社テスト1', 'owner', NULL, true, NOW(), NOW()),
('owner2', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'owner2@example.com', '株式会社テスト2', 'owner', NULL, true, NOW(), NOW()),
('staff1_owner1', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'staff1@owner1.com', NULL, 'staff', 1, true, NOW(), NOW()),
('staff2_owner1', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'staff2@owner1.com', NULL, 'staff', 1, true, NOW(), NOW()),
('staff1_owner2', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'staff1@owner2.com', NULL, 'staff', 2, true, NOW(), NOW()),
('staff2_owner2', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'staff2@owner2.com', NULL, 'staff', 2, true, NOW(), NOW());

INSERT INTO stores (name, address, phone, email, opening_time, closing_time, area, postal_code, owner_id, "createdAt", "updatedAt") VALUES
('福井本店', '福井県福井市下馬3丁目1601', '0776-76-2247', NULL, '07:00', '19:00', '福井県', '918-8112', 1, NOW(), NOW()),
('くるふ福井駅店', '福井県福井市中央1丁目1-25 くるふ福井駅内', NULL, NULL, '08:30', '20:00', '福井県', '910-0006', 1, NOW(), NOW()),
('MEGAドン・キホーテUNY福井店', '福井県福井市飯塚町11-111 MEGAドン・キホーテUNY福井店1F', NULL, NULL, '09:00', '19:00', '福井県', '918-8067', 1, NOW(), NOW()),
('金沢8号線店', '石川県金沢市二ツ屋町10-8', NULL, NULL, '07:00', '19:00', '石川県', '920-0065', 1, NOW(), NOW()),
('金沢エムザ店', '石川県金沢市武蔵町15-1 金沢エムザ 地階 食品フロア', NULL, NULL, '10:00', '19:00', '石川県', '920-8583', 1, NOW(), NOW()),
('岐阜羽島本店', '岐阜県羽島市舟橋町本町5-25', NULL, NULL, '07:00', '17:00', '岐阜県', '501-6303', 1, NOW(), NOW()),
('羽島インター店', '岐阜県羽島市舟橋町字江北西269-1', NULL, NULL, '07:00', '19:00', '岐阜県', '501-6302', 1, NOW(), NOW()),
('大垣イオンタウン店', '岐阜県大垣市三塚町丹瀬463-1 イオンタウン大垣 EAST 1階 フードコート内', NULL, NULL, '10:30', '18:00', '岐阜県', '503-0808', 1, NOW(), NOW());

INSERT INTO business_hours (store_id, day_of_week, is_closed, opening_time, closing_time, "createdAt", "updatedAt") VALUES
(1, 0, false, '07:00', '19:00', NOW(), NOW()),
(1, 1, false, '07:00', '19:00', NOW(), NOW()),
(1, 2, false, '07:00', '19:00', NOW(), NOW()),
(1, 3, false, '07:00', '19:00', NOW(), NOW()),
(1, 4, false, '07:00', '19:00', NOW(), NOW()),
(1, 5, false, '07:00', '19:00', NOW(), NOW()),
(1, 6, false, '07:00', '19:00', NOW(), NOW()),
(2, 0, false, '08:30', '20:00', NOW(), NOW()),
(2, 1, false, '08:30', '20:00', NOW(), NOW()),
(2, 2, false, '08:30', '20:00', NOW(), NOW()),
(2, 3, false, '08:30', '20:00', NOW(), NOW()),
(2, 4, false, '08:30', '20:00', NOW(), NOW()),
(2, 5, false, '08:30', '20:00', NOW(), NOW()),
(2, 6, false, '08:30', '20:00', NOW(), NOW()),
(3, 0, false, '09:00', '19:00', NOW(), NOW()),
(3, 1, false, '09:00', '19:00', NOW(), NOW()),
(3, 2, false, '09:00', '19:00', NOW(), NOW()),
(3, 3, false, '09:00', '19:00', NOW(), NOW()),
(3, 4, false, '09:00', '19:00', NOW(), NOW()),
(3, 5, false, '09:00', '19:00', NOW(), NOW()),
(3, 6, false, '09:00', '19:00', NOW(), NOW()),
(4, 0, false, '07:00', '19:00', NOW(), NOW()),
(4, 1, false, '07:00', '19:00', NOW(), NOW()),
(4, 2, false, '07:00', '19:00', NOW(), NOW()),
(4, 3, false, '07:00', '19:00', NOW(), NOW()),
(4, 4, false, '07:00', '19:00', NOW(), NOW()),
(4, 5, false, '07:00', '19:00', NOW(), NOW()),
(4, 6, false, '07:00', '19:00', NOW(), NOW()),
(5, 0, false, '10:00', '19:00', NOW(), NOW()),
(5, 1, false, '10:00', '19:00', NOW(), NOW()),
(5, 2, false, '10:00', '19:00', NOW(), NOW()),
(5, 3, false, '10:00', '19:00', NOW(), NOW()),
(5, 4, false, '10:00', '19:00', NOW(), NOW()),
(5, 5, false, '10:00', '19:00', NOW(), NOW()),
(5, 6, false, '10:00', '19:00', NOW(), NOW()),
(6, 0, false, '07:00', '17:00', NOW(), NOW()),
(6, 1, false, '07:00', '17:00', NOW(), NOW()),
(6, 2, false, '07:00', '17:00', NOW(), NOW()),
(6, 3, false, '07:00', '17:00', NOW(), NOW()),
(6, 4, false, '07:00', '17:00', NOW(), NOW()),
(6, 5, false, '07:00', '17:00', NOW(), NOW()),
(6, 6, false, '07:00', '17:00', NOW(), NOW()),
(7, 0, false, '07:00', '19:00', NOW(), NOW()),
(7, 1, false, '07:00', '19:00', NOW(), NOW()),
(7, 2, false, '07:00', '19:00', NOW(), NOW()),
(7, 3, false, '07:00', '19:00', NOW(), NOW()),
(7, 4, false, '07:00', '19:00', NOW(), NOW()),
(7, 5, false, '07:00', '19:00', NOW(), NOW()),
(7, 6, false, '07:00', '19:00', NOW(), NOW()),
(8, 0, false, '10:30', '18:00', NOW(), NOW()),
(8, 1, false, '10:30', '18:00', NOW(), NOW()),
(8, 2, false, '10:30', '18:00', NOW(), NOW()),
(8, 3, false, '10:30', '18:00', NOW(), NOW()),
(8, 4, false, '10:30', '18:00', NOW(), NOW()),
(8, 5, false, '10:30', '18:00', NOW(), NOW()),
(8, 6, false, '10:30', '18:00', NOW(), NOW());

INSERT INTO staff (store_id, first_name, last_name, furigana, gender, position, employment_type, max_hours_per_month, min_hours_per_month, max_hours_per_day, max_consecutive_days, "createdAt", "updatedAt") VALUES
(1, '太郎', '田中', 'タナカ タロウ', '男性', '店長', '正社員', 160, 140, 8, 5, NOW(), NOW()),
(1, '花子', '佐藤', 'サトウ ハナコ', '女性', '副店長', 'パート', 120, 80, 6, 4, NOW(), NOW()),
(2, '次郎', '鈴木', 'スズキ ジロウ', '男性', 'リーダー', 'アルバイト', 100, 60, 8, 5, NOW(), NOW()),
(2, '美咲', '高橋', 'タカハシ ミサキ', '女性', '一般スタッフ', 'パート', 80, 40, 6, 3, NOW(), NOW()),
(3, '健一', '伊藤', 'イトウ ケンイチ', '男性', '店長', '正社員', 160, 140, 8, 5, NOW(), NOW()),
(3, '由美', '渡辺', 'ワタナベ ユミ', '女性', '一般スタッフ', 'アルバイト', 90, 50, 7, 4, NOW(), NOW()),
(4, '雄介', '山本', 'ヤマモト ユウスケ', '男性', 'リーダー', 'パート', 110, 70, 7, 4, NOW(), NOW()),
(4, '麻衣', '中村', 'ナカムラ マイ', '女性', '一般スタッフ', 'アルバイト', 85, 45, 6, 3, NOW(), NOW()),
(5, '大輔', '小林', 'コバヤシ ダイスケ', '男性', '副店長', '正社員', 150, 130, 8, 5, NOW(), NOW()),
(5, '愛', '加藤', 'カトウ アイ', '女性', '一般スタッフ', 'パート', 95, 55, 6, 4, NOW(), NOW()),
(6, '修', '吉田', 'ヨシダ オサム', '男性', 'リーダー', 'パート', 105, 65, 7, 4, NOW(), NOW()),
(6, '恵子', '松本', 'マツモト ケイコ', '女性', '一般スタッフ', 'アルバイト', 88, 48, 6, 3, NOW(), NOW()),
(7, '拓也', '井上', 'イノウエ タクヤ', '男性', '店長', '正社員', 165, 145, 8, 5, NOW(), NOW()),
(7, '智子', '木村', 'キムラ トモコ', '女性', '副店長', 'パート', 125, 85, 7, 4, NOW(), NOW()),
(8, '慎一', '林', 'ハヤシ シンイチ', '男性', 'リーダー', 'アルバイト', 98, 58, 6, 4, NOW(), NOW()),
(8, '京子', '清水', 'シミズ キョウコ', '女性', '一般スタッフ', 'パート', 92, 52, 6, 3, NOW(), NOW());

INSERT INTO staff_stores (staff_id, store_id, "createdAt", "updatedAt") VALUES
(1, 1, NOW(), NOW()),
(1, 2, NOW(), NOW()),
(1, 3, NOW(), NOW()),
(2, 1, NOW(), NOW()),
(2, 2, NOW(), NOW()),
(3, 2, NOW(), NOW()),
(3, 3, NOW(), NOW()),
(4, 2, NOW(), NOW()),
(4, 3, NOW(), NOW()),
(5, 3, NOW(), NOW()),
(5, 4, NOW(), NOW()),
(6, 3, NOW(), NOW()),
(6, 4, NOW(), NOW()),
(7, 4, NOW(), NOW()),
(7, 5, NOW(), NOW()),
(8, 4, NOW(), NOW()),
(8, 5, NOW(), NOW()),
(9, 5, NOW(), NOW()),
(9, 6, NOW(), NOW()),
(10, 5, NOW(), NOW()),
(10, 6, NOW(), NOW()),
(11, 6, NOW(), NOW()),
(11, 7, NOW(), NOW()),
(12, 6, NOW(), NOW()),
(12, 7, NOW(), NOW()),
(13, 7, NOW(), NOW()),
(13, 8, NOW(), NOW()),
(14, 7, NOW(), NOW()),
(14, 8, NOW(), NOW()),
(15, 8, NOW(), NOW()),
(15, 1, NOW(), NOW()),
(16, 8, NOW(), NOW()),
(16, 1, NOW(), NOW());

INSERT INTO staff_day_preferences (staff_id, day_of_week, available, preferred_start_time, preferred_end_time, break_start_time, break_end_time, "createdAt", "updatedAt") VALUES
(1, 0, false, NULL, NULL, NULL, NULL, NOW(), NOW()),
(1, 1, true, '09:00', '18:00', '12:00', '13:00', NOW(), NOW()),
(1, 2, true, '09:00', '18:00', '12:00', '13:00', NOW(), NOW()),
(1, 3, true, '09:00', '18:00', '12:00', '13:00', NOW(), NOW()),
(1, 4, true, '09:00', '18:00', '12:00', '13:00', NOW(), NOW()),
(1, 5, true, '09:00', '18:00', '12:00', '13:00', NOW(), NOW()),
(1, 6, true, '09:00', '17:00', '12:00', '13:00', NOW(), NOW()),
(2, 0, false, NULL, NULL, NULL, NULL, NOW(), NOW()),
(2, 1, true, '10:00', '16:00', '12:30', '13:30', NOW(), NOW()),
(2, 2, true, '10:00', '16:00', '12:30', '13:30', NOW(), NOW()),
(2, 3, true, '10:00', '16:00', '12:30', '13:30', NOW(), NOW()),
(2, 4, true, '10:00', '16:00', '12:30', '13:30', NOW(), NOW()),
(2, 5, true, '10:00', '16:00', '12:30', '13:30', NOW(), NOW()),
(2, 6, false, NULL, NULL, NULL, NULL, NOW(), NOW()),
(3, 0, false, NULL, NULL, NULL, NULL, NOW(), NOW()),
(3, 1, true, '08:30', '17:30', '12:00', '13:00', NOW(), NOW()),
(3, 2, true, '08:30', '17:30', '12:00', '13:00', NOW(), NOW()),
(3, 3, true, '08:30', '17:30', '12:00', '13:00', NOW(), NOW()),
(3, 4, true, '08:30', '17:30', '12:00', '13:00', NOW(), NOW()),
(3, 5, true, '08:30', '17:30', '12:00', '13:00', NOW(), NOW()),
(3, 6, false, NULL, NULL, NULL, NULL, NOW(), NOW()),
(4, 0, true, '11:00', '17:00', '13:00', '14:00', NOW(), NOW()),
(4, 1, false, NULL, NULL, NULL, NULL, NOW(), NOW()),
(4, 2, true, '11:00', '17:00', '13:00', '14:00', NOW(), NOW()),
(4, 3, true, '11:00', '17:00', '13:00', '14:00', NOW(), NOW()),
(4, 4, true, '11:00', '17:00', '13:00', '14:00', NOW(), NOW()),
(4, 5, true, '11:00', '17:00', '13:00', '14:00', NOW(), NOW()),
(4, 6, true, '11:00', '17:00', '13:00', '14:00', NOW(), NOW()),
(5, 0, false, NULL, NULL, NULL, NULL, NOW(), NOW()),
(5, 1, true, '07:00', '16:00', '11:30', '12:30', NOW(), NOW()),
(5, 2, true, '07:00', '16:00', '11:30', '12:30', NOW(), NOW()),
(5, 3, true, '07:00', '16:00', '11:30', '12:30', NOW(), NOW()),
(5, 4, true, '07:00', '16:00', '11:30', '12:30', NOW(), NOW()),
(5, 5, true, '07:00', '16:00', '11:30', '12:30', NOW(), NOW()),
(5, 6, false, NULL, NULL, NULL, NULL, NOW(), NOW()),
(6, 0, true, '14:00', '20:00', '17:00', '18:00', NOW(), NOW()),
(6, 1, true, '14:00', '20:00', '17:00', '18:00', NOW(), NOW()),
(6, 2, false, NULL, NULL, NULL, NULL, NOW(), NOW()),
(6, 3, true, '14:00', '20:00', '17:00', '18:00', NOW(), NOW()),
(6, 4, true, '14:00', '20:00', '17:00', '18:00', NOW(), NOW()),
(6, 5, true, '14:00', '20:00', '17:00', '18:00', NOW(), NOW()),
(6, 6, true, '14:00', '20:00', '17:00', '18:00', NOW(), NOW()),
(7, 0, false, NULL, NULL, NULL, NULL, NOW(), NOW()),
(7, 1, true, '10:00', '17:00', '13:00', '14:00', NOW(), NOW()),
(7, 2, true, '10:00', '17:00', '13:00', '14:00', NOW(), NOW()),
(7, 3, true, '10:00', '17:00', '13:00', '14:00', NOW(), NOW()),
(7, 4, true, '10:00', '17:00', '13:00', '14:00', NOW(), NOW()),
(7, 5, true, '10:00', '17:00', '13:00', '14:00', NOW(), NOW()),
(7, 6, false, NULL, NULL, NULL, NULL, NOW(), NOW()),
(8, 0, true, '12:00', '18:00', '15:00', '16:00', NOW(), NOW()),
(8, 1, true, '12:00', '18:00', '15:00', '16:00', NOW(), NOW()),
(8, 2, true, '12:00', '18:00', '15:00', '16:00', NOW(), NOW()),
(8, 3, false, NULL, NULL, NULL, NULL, NOW(), NOW()),
(8, 4, true, '12:00', '18:00', '15:00', '16:00', NOW(), NOW()),
(8, 5, true, '12:00', '18:00', '15:00', '16:00', NOW(), NOW()),
(8, 6, true, '12:00', '18:00', '15:00', '16:00', NOW(), NOW()),
(9, 0, false, NULL, NULL, NULL, NULL, NOW(), NOW()),
(9, 1, true, '10:00', '17:00', '13:00', '14:00', NOW(), NOW()),
(9, 2, true, '10:00', '17:00', '13:00', '14:00', NOW(), NOW()),
(9, 3, true, '10:00', '17:00', '13:00', '14:00', NOW(), NOW()),
(9, 4, true, '10:00', '17:00', '13:00', '14:00', NOW(), NOW()),
(9, 5, true, '10:00', '17:00', '13:00', '14:00', NOW(), NOW()),
(9, 6, false, NULL, NULL, NULL, NULL, NOW(), NOW()),
(10, 0, true, '12:00', '18:00', '15:00', '16:00', NOW(), NOW()),
(10, 1, true, '12:00', '18:00', '15:00', '16:00', NOW(), NOW()),
(10, 2, true, '12:00', '18:00', '15:00', '16:00', NOW(), NOW()),
(10, 3, false, NULL, NULL, NULL, NULL, NOW(), NOW()),
(10, 4, true, '12:00', '18:00', '15:00', '16:00', NOW(), NOW()),
(10, 5, true, '12:00', '18:00', '15:00', '16:00', NOW(), NOW()),
(10, 6, true, '12:00', '18:00', '15:00', '16:00', NOW(), NOW()),
(11, 0, false, NULL, NULL, NULL, NULL, NOW(), NOW()),
(11, 1, true, '09:00', '16:00', '12:00', '13:00', NOW(), NOW()),
(11, 2, true, '09:00', '16:00', '12:00', '13:00', NOW(), NOW()),
(11, 3, true, '09:00', '16:00', '12:00', '13:00', NOW(), NOW()),
(11, 4, true, '09:00', '16:00', '12:00', '13:00', NOW(), NOW()),
(11, 5, true, '09:00', '16:00', '12:00', '13:00', NOW(), NOW()),
(11, 6, false, NULL, NULL, NULL, NULL, NOW(), NOW()),
(12, 0, true, '13:00', '19:00', '16:00', '17:00', NOW(), NOW()),
(12, 1, true, '13:00', '19:00', '16:00', '17:00', NOW(), NOW()),
(12, 2, false, NULL, NULL, NULL, NULL, NOW(), NOW()),
(12, 3, true, '13:00', '19:00', '16:00', '17:00', NOW(), NOW()),
(12, 4, true, '13:00', '19:00', '16:00', '17:00', NOW(), NOW()),
(12, 5, true, '13:00', '19:00', '16:00', '17:00', NOW(), NOW()),
(12, 6, true, '13:00', '19:00', '16:00', '17:00', NOW(), NOW()),
(13, 0, false, NULL, NULL, NULL, NULL, NOW(), NOW()),
(13, 1, true, '08:00', '17:00', '12:00', '13:00', NOW(), NOW()),
(13, 2, true, '08:00', '17:00', '12:00', '13:00', NOW(), NOW()),
(13, 3, true, '08:00', '17:00', '12:00', '13:00', NOW(), NOW()),
(13, 4, true, '08:00', '17:00', '12:00', '13:00', NOW(), NOW()),
(13, 5, true, '08:00', '17:00', '12:00', '13:00', NOW(), NOW()),
(13, 6, false, NULL, NULL, NULL, NULL, NOW(), NOW()),
(14, 0, true, '11:00', '17:00', '14:00', '15:00', NOW(), NOW()),
(14, 1, true, '11:00', '17:00', '14:00', '15:00', NOW(), NOW()),
(14, 2, true, '11:00', '17:00', '14:00', '15:00', NOW(), NOW()),
(14, 3, false, NULL, NULL, NULL, NULL, NOW(), NOW()),
(14, 4, true, '11:00', '17:00', '14:00', '15:00', NOW(), NOW()),
(14, 5, true, '11:00', '17:00', '14:00', '15:00', NOW(), NOW()),
(14, 6, true, '11:00', '17:00', '14:00', '15:00', NOW(), NOW()),
(15, 0, false, NULL, NULL, NULL, NULL, NOW(), NOW()),
(15, 1, true, '11:00', '17:00', '14:00', '15:00', NOW(), NOW()),
(15, 2, true, '11:00', '17:00', '14:00', '15:00', NOW(), NOW()),
(15, 3, true, '11:00', '17:00', '14:00', '15:00', NOW(), NOW()),
(15, 4, true, '11:00', '17:00', '14:00', '15:00', NOW(), NOW()),
(15, 5, true, '11:00', '17:00', '14:00', '15:00', NOW(), NOW()),
(15, 6, false, NULL, NULL, NULL, NULL, NOW(), NOW()),
(16, 0, true, '12:00', '17:00', '14:30', '15:30', NOW(), NOW()),
(16, 1, true, '12:00', '17:00', '14:30', '15:30', NOW(), NOW()),
(16, 2, true, '12:00', '17:00', '14:30', '15:30', NOW(), NOW()),
(16, 3, false, NULL, NULL, NULL, NULL, NOW(), NOW()),
(16, 4, true, '12:00', '17:00', '14:30', '15:30', NOW(), NOW()),
(16, 5, true, '12:00', '17:00', '14:30', '15:30', NOW(), NOW()),
(16, 6, true, '12:00', '17:00', '14:30', '15:30', NOW(), NOW());