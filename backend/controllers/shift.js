const createShift = async (req, res) => {
    try {
        const { store_id, year, month, status } = req.body;

        if (!store_id || !year || !month) {
            return res.status(400).json({ message: '店舗ID、年、月は必須です' });
        }

        const existingShift = await Shift.findOne({
            where: {
                store_id,
                year,
                month
            }
        });

        if (existingShift) {
            return res.status(400).json({ message: 'この期間のシフトは既に存在します' });
        }

        const shift = await Shift.create({
            store_id,
            year,
            month,
            status: status || 'draft'
        });

        res.status(201).json(shift);
    } catch (error) {
        console.error('シフト作成エラー:', error);
        res.status(500).json({ message: 'シフトの作成中にエラーが発生しました' });
    }
};

module.exports = {
    getAllShifts,
    getShiftById,
    getShiftByYearMonth,
    getSystemSettings,
    createShift,
    generateShift,
    validateShift,
    confirmShift,
    createShiftAssignment,
    updateShiftAssignment,
    deleteShiftAssignment,
    getShiftChangeLogs
};