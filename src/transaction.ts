import {
  BaseError,
  ContractFunctionRevertedError,
  type Abi,
  type Account,
  type Chain,
  type ContractFunctionArgs,
  type ContractFunctionName,
  type PublicClient,
  type RpcSchema,
  type SimulateContractParameters,
  type Transport,
  type WaitForTransactionReceiptParameters,
  type WaitForTransactionReceiptReturnType,
  type WalletClient,
  type WriteContractParameters,
  type WriteContractReturnType,
} from "viem";
import {
  UpdateDuration,
  defaultOnError,
  defaultOnSuccess,
  defaultOnUpdate,
  type Loggers,
} from "./loggers.js";

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
    SimulateContractParameters<abi, functionName, args> | undefined
  >;
  onSubmitted?: (transactionHash: WriteContractReturnType) => void;
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

  loggers.onUpdate?.({
    title: "Simulating transaction",
    description: "Please wait for the simulation to finish...",
  });
  const transactionRequest = simulate
    ? await params.publicClient
        .simulateContract({
          account: params.walletClient.account,
          chain: params.walletClient.chain,
          ...transaction,
        } as SimulateContractParameters<
          abi,
          functionName,
          args,
          chain,
          chain,
          account
        >)
        .catch((err) => {
          let errorName = "Simulation failed.";
          if (err instanceof BaseError) {
            errorName = err.shortMessage ?? errorName;
            const revertError = err.walk(
              (err) => err instanceof ContractFunctionRevertedError
            );
            if (revertError instanceof ContractFunctionRevertedError) {
              errorName += revertError.data?.errorName
                ? ` -> ${revertError.data.errorName}`
                : "";
            }
          }
          loggers.onError?.({
            title: `${transactionName} failed`,
            description: errorName,
            error: err,
          });
          return undefined;
        })
    : {
        request: {
          account: params.walletClient.account,
          chain: params.walletClient.chain,
          ...transaction,
        },
      };
  if (transactionRequest === undefined) {
    return;
  }

  loggers.onUpdate?.({
    title: "Generating transaction",
    description: "Please sign the transaction in your wallet...",
  });
  const transactionHash = await params.walletClient
    .writeContract(
      transactionRequest.request as WriteContractParameters<
        abi,
        functionName,
        args,
        chain,
        account
      >
    )
    .catch((err) => {
      loggers.onError?.({
        title: `${transactionName} failed`,
        description: "Transaction rejected.",
        error: err,
      });
      return undefined;
    });
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
