import React, { useCallback } from 'react';
import { Contract, ethers } from 'ethers';
//import * as c from "../contracts/MoneyRouter.json";
import { useSigner, useContract, useConnect, useAccount, useProvider } from 'wagmi';
import { useState, useEffect } from 'react';
import { Button, Divider, Input, InputNumber } from 'antd';
//import { MoneyRouter } from '../../typechain-types/contracts/MoneyRouter';
import { Framework, IWeb3FlowInfo, Stream_OrderBy, SuperToken } from '@superfluid-finance/sdk-core';
import toast from 'react-hot-toast';
import * as f from "../../deployments/goerli/MoneyRouter.json";
import { isAddress } from 'ethers/lib/utils';

export default function MoneyStreamerFlows() {

    const provider = useProvider();
    const [moneyRouterContract, setMoneyRouterContract] = useState<any>();
    const [incomingFlowData, setIncomingFlowData] = useState<IWeb3FlowInfo>();
    const [daiXContract, setdaiXContract] = useState<SuperToken>();
    const [approved, setApproved] = useState<boolean>(false);
    const [amountWeiPerSecIn, setAmountWeiPerSecIn] = useState<number>(0);
    const [amountWeiPerSecOut, setAmountWeiPerSecOut] = useState<number>(0);
    const [amountDAITransferOp, setAmountDAITransferOp] = useState<number>(0);
    const [recipient, setRecipient] = useState("");
    const [contractBalance, setContractBalance] = useState<ethers.BigNumber>(ethers.BigNumber.from(0));
    const { data: signer } = useSigner();
    const { address, isConnected } = useAccount();

    const approve = async () => {
        // We approve the contract to fully control our streams, simply because we want to only ask for user allowance once.
        if (!approved) {
            await daiXContract?.authorizeFlowOperatorWithFullControl({ flowOperator: f.address }).exec(signer!);
            await updateApproved();
        }
    }

    const revoke = async () => {
        // We approve the contract to fully control our streams, simply because we want to only ask for user allowance once.
        if (approved) {
            await daiXContract?.revokeFlowOperatorWithFullControl({ flowOperator: f.address }).exec(signer!);
            await updateApproved();   
        }
    }

    const updateApproved = async () => {
        console.log('add', address, 'contract', moneyRouterContract);
        const currPermissions = await daiXContract?.getFlowOperatorData({
            sender: address!,
            flowOperator: moneyRouterContract?.address!, providerOrSigner: provider
        });
        console.log('fetched permissions', currPermissions);
        setApproved(currPermissions?.permissions === '7' ? true : false);
    };

    const isFlowActive = () => ethers.BigNumber.from(incomingFlowData?.flowRate).gt(0) ? true : false;

    const fetchIncomingFlowData = async () => {
        console.log('moneyRouterInsideFetchFlow', moneyRouterContract!, 'dai', daiXContract);
        // incoming
        const flow = await daiXContract?.getFlow({
            sender: address!,
            receiver: moneyRouterContract?.address!,
            providerOrSigner: provider
        });
        console.log('fetched incoming flow', flow);
        setIncomingFlowData(flow);
    };

    const fetchOutgoingFlowData = async () => {
        /*
        daiXContract?.getFlow({})
        const flow = await daiXContract?.getFlow({
            sender: address!,
            receiver: moneyRouterContract?.address!,
            providerOrSigner: provider
        });
        console.log('fetched outgoing flow', flow);
        setOutgoingFlowData(flow);
        */
    };

    const fetchContractBalance = async () => {
        const fetchedContractBalance = await daiXContract?.balanceOf({ account: moneyRouterContract?.address!, providerOrSigner: provider });
        const contractBalanceInDaiUnits = ethers.BigNumber.from(fetchedContractBalance).div(ethers.utils.parseEther("1"));
        console.log('contract balance', contractBalanceInDaiUnits);
        setContractBalance(contractBalanceInDaiUnits);
    };

    useEffect(() => {
        console.log('changed signer');
        Promise.all([fetchContract(), fetchDaiXCoin()]);
    }, []);

    useEffect(() => {
        console.log('useEffect2', moneyRouterContract, daiXContract);
        Promise.all([fetchIncomingFlowData(), updateApproved(), fetchContractBalance()]);
    }, [daiXContract, moneyRouterContract]);

    const fetchContract = async () => {
        console.log('fetch contract');
        const c2 = new ethers.Contract(f.address, f.abi, signer!);
        console.log('contract', c2);
        setMoneyRouterContract(c2);
    };

    const fetchDaiXCoin = async () => {
        let framework = await Framework.create({
            chainId: provider.network.chainId, //i.e. 137 for matic
            provider: provider
        });
        const DAIxContract = await framework.loadSuperToken("fDAIx");
        setdaiXContract(DAIxContract);
    };

    const createFlowIntoContract = async () => {
        const tx = await moneyRouterContract?.connect(signer).createFlowIntoContract(daiXContract?.address!,
            amountWeiPerSecIn.toString(), { gasLimit: ethers.BigNumber.from("800000") });
        await toast.promise(tx?.wait()!, {
            loading: 'Creating flow',
            error: 'Flow could not be created',
            success: 'Flow created'
        });
        await fetchIncomingFlowData();
    };

    const updateFlowIntoContract = async () => {
        if (!incomingFlowData) {
            toast.error('No existing flow to update');
            return;
        }
        const tx = await moneyRouterContract?.connect(signer).updateFlowIntoContract(daiXContract?.address!, amountWeiPerSecIn.toString(), { gasLimit: ethers.BigNumber.from("800000") });
        await toast.promise(tx?.wait()!,
            {
                loading: 'Executing transaction',
                success: 'Updated flow',
                error: 'Flow could not be updated'
            });
        await fetchIncomingFlowData();
    };

    const deleteFlowIntoContract = async () => {

        if (isFlowActive()) {
            const tx = await moneyRouterContract?.connect(signer).deleteFlowIntoContract(daiXContract?.address!, { gasLimit: ethers.BigNumber.from("800000") });
            await toast.promise(tx?.wait()!,
                {
                    loading: 'Executing transaction',
                    success: 'Deleted flow',
                    error: 'Flow could not be deleted'
                });
            await fetchIncomingFlowData();

        }
        else {
            toast.error("No flow to delete");
        }
    };

    const sendLumpSumIntoContract = async () => {
        console.log('lump sum');

        const amount = ethers.utils.parseEther(amountDAITransferOp.toString());
        const allowance = await daiXContract?.allowance({ owner: address!, spender: moneyRouterContract?.address!, providerOrSigner: signer! });
        console.log('fetched allowance', ethers.BigNumber.from(allowance));
        if (ethers.BigNumber.from(allowance).lt(amount)) {
            console.log('triggering approval');
            await daiXContract?.approve({ receiver: moneyRouterContract?.address!, amount: amount.toString() }).exec(signer!);
        }


        const tx = await moneyRouterContract?.connect(signer).sendLumpSumToContract(daiXContract?.address!,
            amount, { gasLimit: ethers.BigNumber.from("800000") });
        await toast.promise(tx?.wait()!, {
            loading: 'Sending lump sum',
            error: 'Could not send lump sum',
            success: 'Lump sum sent'
        });
        await fetchContractBalance();
    };
    const withdrawFromContract = async () => {
        console.log('balance', contractBalance);
        const amount = ethers.utils.parseEther(amountDAITransferOp.toString());
        const tx = await moneyRouterContract?.connect(signer).withdrawFunds(daiXContract?.address!,
            amount, { gasLimit: ethers.BigNumber.from("800000") });
        await toast.promise(tx?.wait()!, {
            loading: 'Withdrawing funds',
            error: 'Could not withdraw funds',
            success: 'Funds successfully withdrawn'
        });
        await fetchContractBalance();
    };

    const isRecipientValidAddress = (): boolean => {
        if (!isAddress(recipient)) {
            toast.error("Recipient not valid");
            return false;
        }
        return true;
    };

    const createFlowFromContract = async () => {

        if (!isRecipientValidAddress()) {
            return;
        }

        const tx = await moneyRouterContract?.connect(signer).createFlowFromContract(daiXContract?.address!,
            recipient,
            amountWeiPerSecOut.toString(), { gasLimit: ethers.BigNumber.from("800000") });
        await toast.promise(tx?.wait()!, {
            loading: 'Creating flow',
            error: 'Flow could not be created',
            success: 'Flow created'
        });
    };

    const updateFlowFromContract = async () => {
        console.log('update flow');
        const tx = await moneyRouterContract?.connect(signer).updateFlowFromContract(daiXContract?.address!, recipient,
            amountWeiPerSecOut.toString(),
            { gasLimit: ethers.BigNumber.from("800000") });
        await toast.promise(tx?.wait()!,
            {
                loading: 'Executing transaction',
                success: 'Updated flow',
                error: 'Flow could not be updated'
            });
        await fetchIncomingFlowData();
    };

    const deleteFlowFromContract = async () => {
        console.log('delete');
        if (!isRecipientValidAddress()) {
            return;
        }

        const tx = await moneyRouterContract?.connect(signer).deleteFlowFromContract(daiXContract?.address!,
            recipient, { gasLimit: ethers.BigNumber.from("800000") });
        await toast.promise(tx?.wait()!,
            {
                loading: 'Executing transaction',
                success: 'Deleted flow',
                error: 'Flow could not be deleted'
            });
    };

    return (
        <>
            {isConnected &&
                <>

                    <h3>Transfer operations</h3>
                    <InputNumber addonBefore="fDAIx" min={1} value={amountDAITransferOp} onChange={(value) => setAmountDAITransferOp(value ?? 0)} />
                    <Button shape='round' type="primary" onClick={sendLumpSumIntoContract}>Send lump sum into contract</Button>
                    <Button shape='round' type="primary" onClick={withdrawFromContract}>Withdraw funds</Button>


                    <h3>Streaming into contract</h3>
                    <p>Current DAI flow into contract - {incomingFlowData?.flowRate} WEI</p>
                    <InputNumber addonBefore="Wei per sec" min={1} value={amountWeiPerSecIn} onChange={(value) => setAmountWeiPerSecIn(value ?? 0)} />
                    <Divider />

                    <Button shape='round' type="primary" onClick={approve}>Approve flows</Button>
                    <Button shape='round' type="primary" onClick={revoke}>Revoke approval</Button>
                    <Button disabled={!approved} shape='round' type="primary" onClick={createFlowIntoContract}>Create flow into contract</Button>
                    <Button disabled={!approved} shape='round' type="primary" onClick={updateFlowIntoContract}>Update flow into contract</Button>
                    <Button disabled={!approved} shape='round' type="primary" onClick={deleteFlowIntoContract}>Delete flow into contract</Button>

                    <h3>Streaming from contract</h3>
                    <p>Contract balance {contractBalance.toString()} fDAIx</p>
                    <InputNumber addonBefore="Wei per sec" min={1} value={amountWeiPerSecOut} onChange={(value) => setAmountWeiPerSecOut(value ?? 0)} />
                    <Input addonBefore="Recipient" value={recipient} onChange={(e) => setRecipient(e.target.value)} />
                    <Divider />

                    <Button shape='round' type="primary" onClick={createFlowFromContract}>Create flow from contract</Button>
                    <Button shape='round' type="primary" onClick={updateFlowFromContract}>Update flow from contract</Button>
                    <Button shape='round' type="primary" onClick={deleteFlowFromContract}>Delete flow from contract</Button>


                </>
            }
        </>
    )
}
