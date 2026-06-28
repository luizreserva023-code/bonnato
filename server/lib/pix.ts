export function generatePixCode(
  pixKey: string,
  merchantName: string,
  amount: number,
  txId: string,
  merchantCity = "MATEUS LEME",
): string {
  function field(id: string, value: string): string {
    const len = value.length.toString().padStart(2, "0");
    return `${id}${len}${value}`;
  }

  const gui = field("00", "BR.GOV.BCB.PIX");
  const key = field("01", pixKey);
  const merchantAccountInfo = field("26", gui + key);
  const mcc = field("52", "0000");
  const currency = field("53", "986");
  const amountStr = field("54", amount.toFixed(2));
  const country = field("58", "BR");
  const name = field("59", merchantName.substring(0, 25));
  const city = field("60", merchantCity.substring(0, 15).toUpperCase());
  const txIdField = field("05", txId.substring(0, 25));
  const additionalData = field("62", txIdField);

  const payload =
    "000201" +
    merchantAccountInfo +
    mcc +
    currency +
    amountStr +
    country +
    name +
    city +
    additionalData +
    "6304";

  let crc = 0xffff;
  for (let i = 0; i < payload.length; i += 1) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j += 1) {
      if (crc & 0x8000) {
        crc = (crc << 1) ^ 0x1021;
      } else {
        crc <<= 1;
      }
      crc &= 0xffff;
    }
  }

  return payload + crc.toString(16).toUpperCase().padStart(4, "0");
}

export function generatePixQrCodeUrl(pixCode: string): string {
  const encoded = encodeURIComponent(pixCode);
  return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encoded}`;
}
