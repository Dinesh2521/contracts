import * as chai from 'chai';
import {chaiSetup} from '../../../util/chai_setup';
import { Balances } from '../../../util/balances';
import { BNUtil } from '../../../util/bn_util';
import { testUtil } from '../../../util/test_util';
import { ContractInstance } from '../../../util/types';
import { Artifacts } from '../../../util/artifacts';

chaiSetup.configure();
const expect = chai.expect;

const {
  Exchange,
  Proxy,
  DummyToken,
  TokenRegistry,
} = new Artifacts(artifacts);

const { add, sub } = BNUtil;

contract('Proxy', (accounts: string[]) => {
  const INITIAL_BALLANCE = 100000000;
  const INITIAL_ALLOWANCE = 100000000;

  const owner = accounts[0];
  const notAuthorized = owner;

  let proxy: ContractInstance;
  let tokenRegistry: ContractInstance;
  let rep: ContractInstance;
  let dmyBalances: Balances;

  before(async () => {
    [proxy, tokenRegistry] = await Promise.all([
      Proxy.deployed(),
      TokenRegistry.deployed(),
    ]);
    const repAddress = await tokenRegistry.getTokenAddressBySymbol('REP');
    rep = DummyToken.at(repAddress);

    dmyBalances = new Balances([rep], [accounts[0], accounts[1]]);
    await Promise.all([
      rep.approve(Proxy.address, INITIAL_ALLOWANCE, { from: accounts[0] }),
      rep.setBalance(accounts[0], INITIAL_BALLANCE, { from: owner }),
      rep.approve(Proxy.address, INITIAL_ALLOWANCE, { from: accounts[1] }),
      rep.setBalance(accounts[1], INITIAL_BALLANCE, { from: owner }),
    ]);
  });

  describe('transferFrom', () => {
    it('should throw when called by an unauthorized address', async () => {
      try {
        await proxy.transferFrom(rep.address, accounts[0], accounts[1], 1000, { from: notAuthorized });
        throw new Error('proxy.transferFrom succeeded when it should have thrown');
      } catch (err) {
        testUtil.assertThrow(err);
      }
    });

    it('should allow an authorized address to transfer', async () => {
      const balances = await dmyBalances.getAsync();

      await proxy.addAuthorizedAddress(notAuthorized, { from: owner });
      const transferAmt = 10000;
      await proxy.transferFrom(rep.address, accounts[0], accounts[1], transferAmt, { from: notAuthorized });

      const newBalances = await dmyBalances.getAsync();
      expect(newBalances[accounts[0]][rep.address])
        .to.be.bignumber.equal(sub(balances[accounts[0]][rep.address], transferAmt));
      expect(newBalances[accounts[1]][rep.address])
        .to.be.bignumber.equal(add(balances[accounts[1]][rep.address], transferAmt));
    });
  });
});
