import { readFileSync } from 'node:fs';
import { Agent, setGlobalDispatcher } from 'undici';

const caBundlePath = process.env.TBANK_INVEST_CA_BUNDLE?.trim();

if (caBundlePath) {
  let ca: string;
  try {
    ca = readFileSync(caBundlePath, 'utf-8');
  } catch (error) {
    throw Object.assign(
      new Error(
        `Не удалось прочитать файл корневого сертификата по пути "${caBundlePath}" из TBANK_INVEST_CA_BUNDLE.`,
      ),
      { cause: error },
    );
  }

  if (ca.trim().length === 0) {
    throw new Error(
      `Файл, указанный в TBANK_INVEST_CA_BUNDLE (${caBundlePath}), не содержит данных сертификата.`,
    );
  }

  setGlobalDispatcher(
    new Agent({
      connect: {
        ca,
      },
    }),
  );
}
