import React, { useCallback } from 'react';
import { Contract, ethers } from 'ethers';
//import * as c from "../contracts/MoneyRouter.json";
import { useSigner, useContract, useConnect, useAccount, useProvider } from 'wagmi';
import { useState, useEffect } from 'react';
import { Button, Divider, Input, InputNumber } from 'antd';
import { MoneyRouter } from '../../typechain-types/contracts/MoneyRouter';
import { Framework, IWeb3FlowInfo, Stream_OrderBy, SuperToken } from '@superfluid-finance/sdk-core';
import toast from 'react-hot-toast';
import * as f from "../../deployments/goerli/MoneyRouter.json";

export default function MoneyStreamerInteraction() {

    const provider = useProvider();
    const [moneyRouterContract, setMoneyRouterContract] = useState<MoneyRouter>();
    const [flowData, setFlowData] = useState<IWeb3FlowInfo>();
    const [daiXContract, setdaiXContract] = useState<SuperToken>();
    const [approved, setApproved] = useState<boolean>(false);
    const [amountWeiPerSec, setAmountWeiPerSec] = useState<number>(0);
    const { data: signer } = useSigner();
    const { address, isConnected } = useAccount();

    const approve = async () => {
        // We approve the contract to fully control our streams, simply because we want to only ask for user allowance once.
        if (!approved) {
            await daiXContract?.authorizeFlowOperatorWithFullControl({ flowOperator: f.address }).exec(signer!);
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

    const isFlowActive = () => ethers.BigNumber.from(flowData?.flowRate).gt(0) ? true : false;

    const fetchFlowData = async () => {
        console.log('moneyRouterInsideFetchFlow', moneyRouterContract!, 'dai', daiXContract);
        const flow = await daiXContract?.getFlow({
            sender: address!,
            receiver: moneyRouterContract?.address!,
            providerOrSigner: provider
        });
        console.log('fetched flow', flow);
        setFlowData(flow);
    };

    useEffect(() => {
        console.log('changed signer');
        Promise.all([fetchContract(), fetchDaiXCoin()]);
    }, []);

    useEffect(() => {
        console.log('useEffect2', moneyRouterContract, daiXContract);
        Promise.all([fetchFlowData(), updateApproved()]);
    }, [daiXContract, moneyRouterContract]);

    const fetchContract = async () => {
        console.log('fetch contract');
        const c2 = new ethers.Contract(f.address, f.abi, signer!);
        console.log('contract', c2);
        setMoneyRouterContract(c2 as MoneyRouter)
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
        const tx = await moneyRouterContract?.createFlowIntoContract(daiXContract?.address!,
            amountWeiPerSec.toString(), { gasLimit: ethers.BigNumber.from("800000") });
        await toast.promise(tx?.wait()!, {
            loading: 'Creating flow',
            error: 'Flow could not be created',
            success: 'Flow created'
        });
        await fetchFlowData();
    };

    const updateFlowIntoContract = async () => {
        if (!flowData) {
            toast.error('No existing flow to update');
            return;
        }
        const tx = await moneyRouterContract?.updateFlowIntoContract(daiXContract?.address!, amountWeiPerSec.toString(), { gasLimit: ethers.BigNumber.from("800000") });
        await toast.promise(tx?.wait()!,
            {
                loading: 'Executing transaction',
                success: 'Updated flow',
                error: 'Flow could not be updated'
            });
        await fetchFlowData();
    };

    const deleteFlowIntoContract = async () => {

        if (isFlowActive()) {
            const tx = await moneyRouterContract?.deleteFlowIntoContract(daiXContract?.address!, { gasLimit: ethers.BigNumber.from("800000") });
            await toast.promise(tx?.wait()!,
                {
                    loading: 'Executing transaction',
                    success: 'Deleted flow',
                    error: 'Flow could not be deleted'
                });
            await fetchFlowData();

        }
        else {
            toast.error("No flow to delete");
        }
    };

    return (
        <>
            {isConnected &&
                <>
                    <p>Current DAI flow into contract - {flowData?.flowRate} WEI</p>
                    <InputNumber addonBefore="Wei per sec" min={1} value={amountWeiPerSec} onChange={(value) => setAmountWeiPerSec(value ?? 0)} />
                    <Divider />

                    <Button shape='round' type="primary" onClick={approve}>Approve flows</Button>
                    <Button disabled={!approved} shape='round' type="primary" onClick={createFlowIntoContract}>Create flow into contract</Button>
                    <Button disabled={!approved} shape='round' type="primary" onClick={updateFlowIntoContract}>Update flow into contract</Button>
                    <Button disabled={!approved} shape='round' type="primary" onClick={deleteFlowIntoContract}>Delete flow into contract</Button>
                </>
            }
        </>
    )
}
