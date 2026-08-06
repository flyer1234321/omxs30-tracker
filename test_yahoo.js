const YahooFinance = require('yahoo-finance2').default;
const yahooFinance = new YahooFinance();

async function test() {
  try {
    const period1 = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    const res = await yahooFinance.chart('VOLV-B.ST', { period1, interval: '5m' });
    console.log("Success! Data length:", res.quotes.length);
  } catch(e) {
    console.error("Error:", e);
  }
}
test();
