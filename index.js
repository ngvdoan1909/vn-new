const puppeteer = require('puppeteer');
const fs = require('fs');
const XLSX = require('xlsx');

(async () => {
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();

    console.log('Đang vào trang...');
    await page.goto('https://flo.uri.sh/visualisation/23815276/embed?auto=1', {
        waitUntil: 'networkidle2',
        timeout: 60000
    });

    await page.waitForSelector('#table-inner', { timeout: 30000 });

    const totalPages = await page.$eval('.pagination-total', el => {
        return parseInt(el.textContent.trim());
    });

    const allData = [];

    for (let currentPage = 1; currentPage <= totalPages; currentPage++) {
        console.log(`Trang ${currentPage}/${totalPages}`);

        await page.waitForSelector('#table-inner tbody tr', { timeout: 30000 });

        const pageData = await page.evaluate(() => {
            const data = [];
            const rows = document.querySelectorAll('#table-inner tbody tr');

            rows.forEach(row => {
                const cells = row.querySelectorAll('.td');
                if (cells.length < 3) return;

                data.push({
                    Tỉnh: cells[0].querySelector('.cell-body p')?.textContent?.trim() || '',
                    "Phường/Xã mới": cells[1].querySelector('.cell-body p')?.textContent?.trim() || '',
                    "Phường/Xã cũ": cells[2].querySelector('.cell-body p')?.textContent?.trim() || ''
                });
            });

            return data;
        });

        allData.push(...pageData);

        if (currentPage < totalPages) {
            await page.click('button.pagination-btn.next:not([disabled])');
            await page.waitForFunction(
                currentPage => {
                    const pageInput = document.querySelector('#pagination input[type="number"]');
                    return pageInput && parseInt(pageInput.value) === currentPage + 1;
                },
                { timeout: 5000 },
                currentPage
            );
        }
    }

    console.log('Đã thu thập xong dữ liệu. Đang lưu file...');

    const csvContent = [
        'Tỉnh,Phường/Xã mới,Phường/Xã cũ',
        ...allData.map(item => `"${item.Tỉnh.replace(/"/g, '""')}","${item["Phường/Xã mới"].replace(/"/g, '""')}","${item["Phường/Xã cũ"].replace(/"/g, '""')}"`)
    ].join('\n');
    fs.writeFileSync('data.csv', csvContent, 'utf8');
    console.log('Đã lưu file CSV: data.csv');

    const worksheet = XLSX.utils.json_to_sheet(allData);
    const workbook = XLSX.utils.book_new();
    worksheet['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: allData.length, c: 2 } }) };

    const headerStyle = { font: { bold: true } };
    for (let col = 0; col < 3; col++) {
        const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col });
        if (!worksheet[cellAddress].s) worksheet[cellAddress].s = {};
        Object.assign(worksheet[cellAddress].s, headerStyle);
    }

    XLSX.utils.book_append_sheet(workbook, worksheet, 'Danh sách phường xã');
    XLSX.writeFile(workbook, 'data.xlsx');
    console.log('Đã lưu file Excel: data.xlsx');

    fs.writeFileSync('data.json', JSON.stringify(allData, null, 2), 'utf8');
    console.log('Đã lưu file JSON: data.json');

    await browser.close();
})();