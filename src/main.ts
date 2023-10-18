import { TypeormDatabase } from "@subsquid/typeorm-store";
import { BlockEntity, Delegation, Sig } from "./model";
import {
  processor,
  CONTRACT_ADDRESS_DELEGATE,
  CONTRACT_ADDRESS_GNOSIS_SAFE_V1_0_0,
  CONTRACT_ADDRESS_GNOSIS_SAFE_V1_1_1,
  CONTRACT_ADDRESS_GNOSIS_SAFE_V1_3_0,
  Log,
} from "./processor";
import * as DelegateRegistry from "./abi/DelegateRegistry";
import * as GnosisSafe from "./abi/GnosisSafe";
import { decodeHex } from "@subsquid/evm-processor";
import * as ProxyFactory100 from "./abi/GnosisSafeProxyFactory_v1.0.0";
import * as ProxyFactory111 from "./abi/GnosisSafeProxyFactory_v1.1.1";
import * as ProxyFactory130 from "./abi/GnosisSafeProxyFactory_v1.3.0";
let factoryProxy: Set<string>;

processor.run(new TypeormDatabase({ supportHotBlocks: true }), async (ctx) => {
  let delegations: Map<string, Delegation> = new Map();
  let clearDelegations: Map<string, string> = new Map();
  let blocks: BlockEntity[] = [];
  let sigs: Map<string, Sig> = new Map();

  if (!factoryProxy) {
    factoryProxy = await ctx.store
      .findBy(Sig, {})
      .then((q) => new Set(q.map((i) => i.id)));
  }

  for (let block of ctx.blocks) {
    blocks.push(
      new BlockEntity({
        id: block.header.hash,
        number: BigInt(block.header.height),
        timestamp: BigInt(block.header.timestamp),
      })
    );
    // ctx.log.info(
    //   `Block: [id: ${block.header.hash}, number: ${BigInt(
    //     block.header.height
    //   )}]`
    // );

    for (let log of block.logs) {
      // decode and normalize the tx data
      if (
        [
          CONTRACT_ADDRESS_GNOSIS_SAFE_V1_0_0,
          CONTRACT_ADDRESS_GNOSIS_SAFE_V1_1_1,
          CONTRACT_ADDRESS_GNOSIS_SAFE_V1_3_0,
        ].includes(log.address) &&
        [
          ProxyFactory100.events.ProxyCreation.topic,
          ProxyFactory111.events.ProxyCreation.topic,
          ProxyFactory130.events.ProxyCreation.topic,
        ].includes(log.topics[0])
      ) {
        handleProxyCreaton(log);
      }

      if (
        factoryProxy.has(log.address.toLowerCase()) &&
        log.topics[0] == GnosisSafe.events.SignMsg.topic
      ) {
        let { msgHash } = GnosisSafe.events.SignMsg.decode(log);
        if (!sigs.get(log.id)) {
          sigs.set(
            log.id,
            new Sig({
              id: log.id,
              account: decodeHex(log.address),
              msgHash: msgHash,
              timestamp: BigInt(block.header.timestamp),
            })
          );
          ctx.log.info(
            `SignMsg: [id: ${log.id}, account: ${log.address}, msgHash: ${msgHash}]`
          );
        }
      }

      if (log.address == CONTRACT_ADDRESS_DELEGATE) {
        if (log.topics[0] == DelegateRegistry.events.SetDelegate.topic) {
          let { delegator, id, delegate } =
            DelegateRegistry.events.SetDelegate.decode(log);
          let space = id;
          id = delegator.concat("-").concat(space).concat("-").concat(delegate);
          delegations.set(
            id,
            new Delegation({
              id: id,
              delegator: decodeHex(delegator),
              space: space,
              delegate: decodeHex(delegate),
              timestamp: BigInt(block.header.timestamp),
            })
          );
          ctx.log.info(
            `SetDelegate: [id: ${id}, delegator: ${delegator}, space: ${space}, delegate: ${delegate}]`
          );
        }

        if (log.topics[0] == DelegateRegistry.events.ClearDelegate.topic) {
          let { delegator, id, delegate } =
            DelegateRegistry.events.ClearDelegate.decode(log);
          let space = id;
          id = delegator.concat("-").concat(space).concat("-").concat(delegate);
          // check id is exist
          let isExistOnDB = await ctx.store.get(Delegation, id);
          // let isExistOnMap = delegations.get(id);
          if (isExistOnDB) {
            clearDelegations.set(id, id);
            ctx.log.info(
              `ClearDelegate: [id: ${id}, delegator: ${delegator}, space: ${space}, delegate: ${delegate}]`
            );
          }
        }
      }
    }
  }

  await ctx.store.upsert(blocks);
  await ctx.store.upsert([...delegations.values()]);
  await ctx.store.upsert([...sigs.values()]);
  if (clearDelegations.size != 0) {
    await ctx.store.remove(Delegation, [...clearDelegations.values()]);
  }
});

function handleProxyCreaton(log: Log) {
  if (log.address == CONTRACT_ADDRESS_GNOSIS_SAFE_V1_0_0) {
    factoryProxy.add(
      ProxyFactory100.events.ProxyCreation.decode(log).proxy.toLowerCase()
    );
  }

  if (log.address == CONTRACT_ADDRESS_GNOSIS_SAFE_V1_1_1) {
    factoryProxy.add(
      ProxyFactory111.events.ProxyCreation.decode(log).proxy.toLowerCase()
    );
  }

  if (log.address == CONTRACT_ADDRESS_GNOSIS_SAFE_V1_3_0) {
    factoryProxy.add(
      ProxyFactory130.events.ProxyCreation.decode(log).proxy.toLowerCase()
    );
  }
}
