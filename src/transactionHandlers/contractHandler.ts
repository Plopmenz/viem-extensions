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
  type WalletClient,
  type WriteContractParameters,
} from "viem";
import type { TransactionHandler } from "./transactionHandler.js";

export type ContractHandlerInput<
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
> = {
  publicClient: PublicClient<
    pcTransport,
    chain,
    pcAccountOrAddress,
    pcRpcSchema
  >;
  walletClient: WalletClient<wcTransport, chain, account, wcRpcSchema>;

  contractCall: SimulateContractParameters<abi, functionName, args>;
};

export type ContractHandlerOutput<
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
  wcTransport extends Transport = Transport,
  wcRpcSchema extends RpcSchema | undefined = undefined,
> = {
  walletClient: WalletClient<wcTransport, chain, account, wcRpcSchema>;
  contractCall: WriteContractParameters<abi, functionName, args>;
};

export type ContractHandler<
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
> = TransactionHandler<
  ContractHandlerInput<
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
  >,
  ContractHandlerOutput<
    abi,
    functionName,
    args,
    chain,
    account,
    wcTransport,
    wcRpcSchema
  >
>;

export function getContractHandler<
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
>(): ContractHandler<
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
> {
  return {
    async simulate(input, settings) {
      const transaction = {
        account: input.walletClient.account,
        chain: input.walletClient.chain,
        ...input.contractCall,
      };
      if (!settings?.simulate) {
        return {
          walletClient: input.walletClient,
          contractCall: transaction as WriteContractParameters<
            abi,
            functionName,
            args
          >,
        };
      }

      return await input.publicClient
        .simulateContract(
          transaction as SimulateContractParameters<
            abi,
            functionName,
            args,
            chain,
            chain,
            account
          >
        )
        .then((transactionRequest) => {
          return {
            walletClient: input.walletClient,
            contractCall: transactionRequest.request as WriteContractParameters<
              abi,
              functionName,
              args
            >,
          };
        })
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
          settings?.loggers?.onError?.({
            title: `${settings?.transactionName ?? "Transaction"} failed`,
            description: errorName,
            error: err,
          });
          return undefined;
        });
    },

    async submit(input, settings) {
      return await input.walletClient
        .writeContract(input.contractCall)
        .catch((err) => {
          settings?.loggers?.onError?.({
            title: `${settings?.transactionName ?? "Transaction"} failed`,
            description: "Transaction rejected.",
            error: err,
          });
          return undefined;
        });
    },
  };
}
