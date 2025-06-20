const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();

    console.log('Dang vao link');
    await page.goto('https://flo.uri.sh/visualisation/23815276/embed?auto=1', {
        waitUntil: 'networkidle2',
        timeout: 60000
    });

    console.log('Dang doi table');
    
    await page.waitForSelector('#table-inner', { timeout: 30000 });
    console.log('Tim thay table');

    const totalPages = await page.$eval('.pagination-total', el => {
        return parseInt(el.textContent.trim());
    });
    console.log(`Total page: ${totalPages}`);

    const allData = [];

    for (let currentPage = 1; currentPage <= totalPages; currentPage++) {
        console.log(`[Page: ${currentPage}/${totalPages}...`);
        
        await page.waitForSelector('#table-inner tbody tr', { timeout: 30000 });
        
        const pageData = await page.evaluate(() => {
            const data = [];
            const rows = document.querySelectorAll('#table-inner tbody tr');
            
            rows.forEach(row => {
                const cells = row.querySelectorAll('.td');
                if (cells.length < 3) return;
                
                data.push({
                    tinh: cells[0].querySelector('.cell-body p')?.textContent?.trim() || '',
                    phuongXaMoi: cells[1].querySelector('.cell-body p')?.textContent?.trim() || '',
                    phuongXaCu: cells[2].querySelector('.cell-body p')?.textContent?.trim() || ''
                });
            });
            
            return data;
        });

        allData.push(...pageData);
        console.log(`${pageData.length} ban ghi tu trang ${currentPage}`);

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
            
            await page.waitForFunction(
                () => {
                    const firstRow = document.querySelector('#table-inner tbody tr');
                    return firstRow && firstRow.textContent.trim() !== '';
                },
                { timeout: 5000 }
            );
        }
    }

    fs.writeFileSync('data.json', JSON.stringify(allData, null, 2));
    console.log(`Total: ${allData.length} ban ghi`);

    await browser.close();
})();