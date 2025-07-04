const moment = require('moment-timezone');

const getShiftPeriodByClosingDay = (year, month, closingDay) => {
    let periodStart, periodEnd;

    if (closingDay >= 1 && closingDay <= 31) {
        periodStart = moment(`${year}-${month}-${closingDay}`, 'YYYY-MM-DD').subtract(1, 'month');
        periodEnd = moment(`${year}-${month}-${closingDay}`, 'YYYY-MM-DD').subtract(1, 'day');

        if (closingDay > moment(periodStart).daysInMonth()) {
            periodStart = moment(periodStart).endOf('month');
        }

        if (closingDay > moment(`${year}-${month}`, 'YYYY-MM').daysInMonth()) {
            periodEnd = moment(`${year}-${month}`, 'YYYY-MM').endOf('month').subtract(1, 'day');
        }
    } else {
        periodStart = moment(`${year}-${month}-01`, 'YYYY-MM-DD');
        periodEnd = moment(`${year}-${month}`, 'YYYY-MM').endOf('month');
    }

    return {
        startDate: periodStart.format('YYYY-MM-DD'),
        endDate: periodEnd.format('YYYY-MM-DD'),
        startMoment: periodStart,
        endMoment: periodEnd
    };
};

const getCurrentShiftPeriod = (closingDay = 25) => {
    const today = moment();
    let targetMonth = today.month() + 1;
    let targetYear = today.year();

    if (today.date() <= closingDay) {
        return getShiftPeriodByClosingDay(targetYear, targetMonth, closingDay);
    } else {
        if (targetMonth === 12) {
            targetYear += 1;
            targetMonth = 1;
        } else {
            targetMonth += 1;
        }
        return getShiftPeriodByClosingDay(targetYear, targetMonth, closingDay);
    }
};

const getNextShiftPeriod = (year, month, closingDay = 25) => {
    let nextMonth = month;
    let nextYear = year;

    if (month === 12) {
        nextMonth = 1;
        nextYear += 1;
    } else {
        nextMonth += 1;
    }

    return getShiftPeriodByClosingDay(nextYear, nextMonth, closingDay);
};

const getPreviousShiftPeriod = (year, month, closingDay = 25) => {
    let prevMonth = month;
    let prevYear = year;

    if (month === 1) {
        prevMonth = 12;
        prevYear -= 1;
    } else {
        prevMonth -= 1;
    }

    return getShiftPeriodByClosingDay(prevYear, prevMonth, closingDay);
};

module.exports = {
    getShiftPeriodByClosingDay,
    getCurrentShiftPeriod,
    getNextShiftPeriod,
    getPreviousShiftPeriod
};