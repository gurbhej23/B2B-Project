/**
 * Converts a numerical amount in Indian Rupees into words (Indian numbering system: Lakhs, Crores).
 * Example: 29035 -> "Rupees Twenty Nine Thousand Thirty Five Only"
 */

const ONES = [
  '',
  'One',
  'Two',
  'Three',
  'Four',
  'Five',
  'Six',
  'Seven',
  'Eight',
  'Nine',
  'Ten',
  'Eleven',
  'Twelve',
  'Thirteen',
  'Fourteen',
  'Fifteen',
  'Sixteen',
  'Seventeen',
  'Eighteen',
  'Nineteen',
];

const TENS = [
  '',
  '',
  'Twenty',
  'Thirty',
  'Forty',
  'Fifty',
  'Sixty',
  'Seventy',
  'Eighty',
  'Ninety',
];

function convertBelowThousand(num: number): string {
  let str = '';
  if (num >= 100) {
    str += `${ONES[Math.floor(num / 100)]} Hundred `;
    num %= 100;
  }
  if (num >= 20) {
    str += `${TENS[Math.floor(num / 10)]} `;
    num %= 10;
  }
  if (num > 0) {
    str += `${ONES[num]} `;
  }
  return str.trim();
}

export function amountInWordsINR(amountRupees: number): string {
  if (amountRupees <= 0) {
    return 'Rupees Zero Only';
  }

  const rounded = Math.round(amountRupees * 100) / 100;
  const integerPart = Math.floor(rounded);
  const paisePart = Math.round((rounded - integerPart) * 100);

  let num = integerPart;
  let words = '';

  // Crores (>= 10,000,000)
  if (num >= 10000000) {
    const crores = Math.floor(num / 10000000);
    words += `${convertBelowThousand(crores)} Crore `;
    num %= 10000000;
  }

  // Lakhs (>= 100,000)
  if (num >= 100000) {
    const lakhs = Math.floor(num / 100000);
    words += `${convertBelowThousand(lakhs)} Lakh `;
    num %= 100000;
  }

  // Thousands (>= 1,000)
  if (num >= 1000) {
    const thousands = Math.floor(num / 1000);
    words += `${convertBelowThousand(thousands)} Thousand `;
    num %= 1000;
  }

  // Hundreds & Below
  if (num > 0) {
    words += `${convertBelowThousand(num)} `;
  }

  words = words.trim();
  let result = `Rupees ${words}`;

  if (paisePart > 0) {
    result += ` and ${convertBelowThousand(paisePart)} Paise`;
  }

  result += ' Only';
  return result;
}

