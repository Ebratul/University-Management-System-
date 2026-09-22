import httpStatus from "http-status";
import config from "../config";
import { AppError } from "../utils/AppError";
import { redisClient } from "./redis";

const ID_TOKEN_KEY = "bkash:id_token";
const REFRESH_TOKEN_KEY = "bkash:refresh_token";

const assertConfigured = () => {
  if (
    !config.bkash_base_url ||
    !config.bkash_username ||
    !config.bkash_password ||
    !config.bkash_app_key ||
    !config.bkash_app_secret
  ) {
    throw new AppError(
      httpStatus.SERVICE_UNAVAILABLE,
      "The payment gateway is not configured on this server.",
    );
  }
};

const bkashHeaders = (extra: Record<string, string> = {}) => ({
  "Content-Type": "application/json",
  Accept: "application/json",
  username: config.bkash_username,
  password: config.bkash_password,
  ...extra,
});

const grantToken = async (): Promise<{
  id_token: string;
  refresh_token: string;
}> => {
  const response = await fetch(
    `${config.bkash_base_url}/tokenized/checkout/token/grant`,
    {
      method: "POST",
      headers: bkashHeaders(),
      body: JSON.stringify({
        app_key: config.bkash_app_key,
        app_secret: config.bkash_app_secret,
      }),
    },
  );

  if (!response.ok) {
    throw new AppError(
      httpStatus.BAD_GATEWAY,
      "Failed to obtain a bKash access token.",
    );
  }

  return response.json();
};

const refreshToken = async (
  refresh_token: string,
): Promise<{ id_token: string }> => {
  const response = await fetch(
    `${config.bkash_base_url}/tokenized/checkout/token/refresh`,
    {
      method: "POST",
      headers: bkashHeaders(),
      body: JSON.stringify({
        app_key: config.bkash_app_key,
        app_secret: config.bkash_app_secret,
        refresh_token,
      }),
    },
  );

  if (!response.ok) {
    throw new AppError(
      httpStatus.BAD_GATEWAY,
      "Failed to refresh the bKash access token.",
    );
  }

  return response.json();
};

export const getBkashToken = async (): Promise<string> => {
  assertConfigured();

  const [cachedIdToken, cachedRefreshToken, idTokenTtl] = await Promise.all([
    redisClient.get(ID_TOKEN_KEY),
    redisClient.get(REFRESH_TOKEN_KEY),
    redisClient.ttl(ID_TOKEN_KEY),
  ]);

  if (cachedIdToken && idTokenTtl > 600) {
    return cachedIdToken;
  }

  if (cachedRefreshToken) {
    const refreshed = await refreshToken(cachedRefreshToken);
    await redisClient.set(ID_TOKEN_KEY, refreshed.id_token, {
      expiration: { type: "EX", value: 60 * 60 },
    });
    return refreshed.id_token;
  }

  const granted = await grantToken();
  await Promise.all([
    redisClient.set(ID_TOKEN_KEY, granted.id_token, {
      expiration: { type: "EX", value: 60 * 60 },
    }),
    redisClient.set(REFRESH_TOKEN_KEY, granted.refresh_token, {
      expiration: { type: "EX", value: 60 * 60 * 24 * 28 },
    }),
  ]);

  return granted.id_token;
};

const authorizedFetch = async (path: string, body: Record<string, unknown>) => {
  const idToken = await getBkashToken();

  const url = `${config.bkash_base_url}${path}`;

  console.log("========== bKash Request ==========");
  console.log("URL:", url);
  console.log("BODY:", body);

  const response = await fetch(url, {
    method: "POST",
    headers: bkashHeaders({
      Authorization: idToken,
      "X-App-Key": config.bkash_app_key,
    }),
    body: JSON.stringify(body),
  });

  const rawResponse = await response.text();

  console.log("========== bKash Response ==========");
  console.log("STATUS:", response.status);
  console.log("RESPONSE:", rawResponse);

  let result: any;

  try {
    result = JSON.parse(rawResponse);
  } catch {
    result = { rawResponse };
  }

  if (!response.ok) {
    throw new AppError(
      httpStatus.BAD_GATEWAY,
      result?.statusMessage ||
        result?.message ||
        `bKash request failed with status ${response.status}`,
    );
  }

  return result;
};

export interface IBkashCreatePaymentResult {
  paymentID: string;
  bkashURL: string;
}

export const createBkashPayment = async (params: {
  amount: number;
  invoiceNumber: string;
}): Promise<IBkashCreatePaymentResult> =>
  authorizedFetch("/tokenized/checkout/create", {
    mode: "0011",
    payerReference: params.invoiceNumber,
    callbackURL: config.bkash_callback_url,
    amount: params.amount.toFixed(2),
    currency: "BDT",
    intent: "sale",
    merchantInvoiceNumber: params.invoiceNumber,
  });

export interface IBkashExecutePaymentResult {
  paymentID: string;
  trxID: string;
  transactionStatus: string;
  statusCode: string;
  statusMessage: string;
}

export const executeBkashPayment = async (
  paymentID: string,
): Promise<IBkashExecutePaymentResult> =>
  authorizedFetch("/tokenized/checkout/execute", { paymentID });

export const queryBkashPayment = async (
  paymentID: string,
): Promise<IBkashExecutePaymentResult> =>
  authorizedFetch("/tokenized/checkout/payment/status", { paymentID });
