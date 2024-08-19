import {
  type Abi,
  type Account,
  type Chain,
  type ContractFunctionArgs,
  type ContractFunctionName,
  type PrepareTransactionRequestParameters,
  type PrepareTransactionRequestRequest,
  type PublicClient,
  type RpcSchema,
  type SendTransactionReturnType,
  type SimulateContractParameters,
  type Transport,
  type WaitForTransactionReceiptParameters,
  type WaitForTransactionReceiptReturnType,
  type WalletClient,
  type WriteContractReturnType,
} from "viem";
import {
  UpdateDuration,
  defaultOnError,
  defaultOnSuccess,
  defaultOnUpdate,
  type Loggers,
} from "./loggers.js";
import {
  getContractHandler,
  type ContractHandlerInput,
} from "./transactionHandlers/contractHandler.js";
import type {
  TransactionHandler,
  TransactionHandlerSettings,
} from "./transactionHandlers/transactionHandler.js";
import {
  getRawTransactionHandler,
  type RawTransactionHandlerInput,
} from "./transactionHandlers/rawTransactionHandler.js";

export type TransactionTypes<
  abi extends Abi | readonly unknown[] = Abi,
  functionName extends ContractFunctionName<
    abi,
    "nonpayable" | "payable"
  > = ContractFunctionName<abi, "nonpayable" | "payable">,
  args extends ContractFunctionArgs<
    abi,
    "nonpayable" | "payable",
    functionName
  > = ContractFunctionArgs<abi, "nonpayable" | "payable", functionName>,
> =
  | SimulateContractParameters<abi, functionName, args>
  | PrepareTransactionRequestParameters;

export interface PerformTransactionParameters<
  abi extends Abi | readonly unknown[] = Abi,
  functionName extends ContractFunctionName<
    abi,
    "nonpayable" | "payable"
  > = ContractFunctionName<abi, "nonpayable" | "payable">,
  args extends ContractFunctionArgs<
    abi,
    "nonpayable" | "payable",
    functionName
  > = ContractFunctionArgs<abi, "nonpayable" | "payable", functionName>,
  chain extends Chain = Chain,
  account extends Account = Account,
  pcTransport extends Transport = Transport,
  pcAccountOrAddress extends Account | undefined = undefined,
  pcRpcSchema extends RpcSchema | undefined = undefined,
  wcTransport extends Transport = Transport,
  wcRpcSchema extends RpcSchema | undefined = undefined,
> {
  publicClient?: PublicClient<
    pcTransport,
    chain,
    pcAccountOrAddress,
    pcRpcSchema
  >;
  walletClient?: WalletClient<wcTransport, chain, account, wcRpcSchema>;

  loggers?: Loggers;
  transaction: () => Promise<
    TransactionTypes<abi, functionName, args> | undefined
  >;
  onSubmitted?: (
    transactionHash: WriteContractReturnType | SendTransactionReturnType
  ) => void;
  onConfirmed?: (receipt: WaitForTransactionReceiptReturnType<chain>) => void;

  transactionName?: string;
  simulate?: boolean;
}

export async function performTransaction<
  abi extends Abi | readonly unknown[] = Abi,
  functionName extends ContractFunctionName<
    abi,
    "nonpayable" | "payable"
  > = ContractFunctionName<abi, "nonpayable" | "payable">,
  args extends ContractFunctionArgs<
    abi,
    "nonpayable" | "payable",
    functionName
  > = ContractFunctionArgs<abi, "nonpayable" | "payable", functionName>,
  chain extends Chain = Chain,
  account extends Account = Account,
  pcTransport extends Transport = Transport,
  pcAccountOrAddress extends Account | undefined = undefined,
  pcRpcSchema extends RpcSchema | undefined = undefined,
  wcTransport extends Transport = Transport,
  wcRpcSchema extends RpcSchema | undefined = undefined,
>(
  params: PerformTransactionParameters<
    abi,
    functionName,
    args,
    chain,
    account,
    pcTransport,
    pcAccountOrAddress,
    pcRpcSchema,
    wcTransport,
    wcRpcSchema
  >
) {
  const loggers: Loggers = {
    onError: params.loggers?.onError ?? defaultOnError,
    onUpdate: params.loggers?.onUpdate ?? defaultOnUpdate,
    onSuccess: params.loggers?.onSuccess ?? defaultOnSuccess,
  };
  const transactionName = params.transactionName ?? "Transaction";
  const simulate = params.simulate ?? true;

  if (!params.publicClient || !params.walletClient) {
    loggers.onError?.({
      title: `${transactionName} failed`,
      description: `${params.publicClient ? "Wallet" : "Public"}Client is undefined.`,
    });
    return;
  }

  const transaction = await params.transaction();
  if (transaction === undefined) {
    return;
  }

  let handler: TransactionHandler<{}, any>;

  if (isContractCall(transaction)) {
    const internalHandler = getContractHandler<
      abi,
      functionName,
      args,
      chain,
      account,
      pcTransport,
      pcAccountOrAddress,
      pcRpcSchema,
      wcTransport,
      wcRpcSchema
    >();
    const input: ContractHandlerInput<
      abi,
      functionName,
      args,
      chain,
      account,
      pcTransport,
      pcAccountOrAddress,
      pcRpcSchema,
      wcTransport,
      wcRpcSchema
    > = {
      publicClient: params.publicClient,
      walletClient: params.walletClient,
      contractCall: transaction,
    };
    handler = {
      simulate(_, settings) {
        return internalHandler.simulate(input, settings);
      },
      submit(input, settings) {
        return internalHandler.submit(input, settings);
      },
    };
  } else if (isRawCall<abi, functionName, args>(transaction)) {
    const internalHandler = getRawTransactionHandler<
      chain,
      account,
      PrepareTransactionRequestRequest<chain, chain>,
      pcTransport,
      pcAccountOrAddress,
      pcRpcSchema,
      wcTransport,
      wcRpcSchema
    >();
    const input: RawTransactionHandlerInput<
      chain,
      account,
      PrepareTransactionRequestRequest<chain, chain>,
      pcTransport,
      pcAccountOrAddress,
      pcRpcSchema,
      wcTransport,
      wcRpcSchema
    > = {
      publicClient: params.publicClient,
      walletClient: params.walletClient,
      rawCall: transaction as PrepareTransactionRequestParameters<
        chain,
        account,
        chain,
        account,
        PrepareTransactionRequestRequest<chain, chain>
      >,
    };
    handler = {
      simulate(_, settings) {
        return internalHandler.simulate(input, settings);
      },
      submit(input, settings) {
        return internalHandler.submit(input, settings);
      },
    };
  } else {
    loggers.onError?.({
      title: `${transactionName} failed`,
      description:
        "Input was not recognized as contract call or raw transaction.",
    });
    return;
  }

  const handlerSettings: TransactionHandlerSettings = {
    loggers: loggers,
    transactionName: transactionName,
    simulate: simulate,
  };
  loggers.onUpdate?.({
    title: "Simulating transaction",
    description: "Please wait for the simulation to finish...",
  });
  const handlerRequest = await handler.simulate({}, handlerSettings);
  if (handlerRequest === undefined) {
    return;
  }

  loggers.onUpdate?.({
    title: "Generating transaction",
    description: "Please sign the transaction in your wallet...",
  });
  const transactionHash = await handler.submit(handlerRequest, handlerSettings);
  if (transactionHash === undefined) {
    return;
  }

  loggers.onUpdate?.({
    title: `${transactionName} submitted`,
    description: "Waiting until confirmed on the blockchain...",
    updateDuration: UpdateDuration.Long,
    updateType: {
      type: "ViewTransactionUpdate",
      transactionHash: transactionHash,
    },
  });
  params.onSubmitted?.(transactionHash);

  const receipt: WaitForTransactionReceiptReturnType<chain> =
    await params.publicClient.waitForTransactionReceipt({
      hash: transactionHash,
    } as WaitForTransactionReceiptParameters<chain>);

  loggers.onSuccess?.({
    title: "Success!",
    description: `${transactionName} performed successfully.`,
  });
  params.onConfirmed?.(receipt);
}

export function isContractCall<
  abi extends Abi | readonly unknown[] = Abi,
  functionName extends ContractFunctionName<
    abi,
    "nonpayable" | "payable"
  > = ContractFunctionName<abi, "nonpayable" | "payable">,
  args extends ContractFunctionArgs<
    abi,
    "nonpayable" | "payable",
    functionName
  > = ContractFunctionArgs<abi, "nonpayable" | "payable", functionName>,
>(
  transaction: TransactionTypes<abi, functionName, args>
): transaction is SimulateContractParameters<abi, functionName, args> {
  return (
    (transaction as SimulateContractParameters<abi, functionName, args>).abi !==
    undefined
  );
}

export function isRawCall<
  abi extends Abi | readonly unknown[] = Abi,
  functionName extends ContractFunctionName<
    abi,
    "nonpayable" | "payable"
  > = ContractFunctionName<abi, "nonpayable" | "payable">,
  args extends ContractFunctionArgs<
    abi,
    "nonpayable" | "payable",
    functionName
  > = ContractFunctionArgs<abi, "nonpayable" | "payable", functionName>,
>(
  transaction: TransactionTypes<abi, functionName, args>
): transaction is PrepareTransactionRequestParameters {
  return (
    (transaction as PrepareTransactionRequestParameters).data !== undefined
  );
}
