/**
 * TradingStrategy.ai adapter
 *
 * Trading Strategy is a speculative algorithmic trading protocol for decentralised finance.
 *
 * See the corresponding API endpoint source:
 *
 * - https://github.com/tradingstrategy-ai/frontend/blob/master/src/routes/strategies/tvl/%2Bserver.ts
 *
 * Examples
 * - arca.js - treasuryExports
 * - beefy.js - how to use utils.fetch
 * 
 * TODO: DefiLlama default token lists is limited. It needs to be updated to cover more tokens as otherwise this adapter
 * is missing assets.
 * 
 * To run:
 * 
 *     node test.js projects/trading-strategy/index.js
 */

const utils = require('../helper/utils');
const { treasuryExports } = require("../helper/treasury")
const { defaultTokens } = require('../helper/cex')
const { sumTokensExport, sumTokens } = require('../helper/sumTokens')

let cachedReply = null;

const chainNames = {
  1: "ethereum",
  137: "polygon",
  5000: "mantle",
  8453: "base",
  56: "bsc"
}


// Get vaults for all chains, cached in-process memory
async function fetchDataCached() {
  if(!cachedReply) {
    cachedReply = (await fetch('https://tradingstrategy.ai/strategies/tvl')).json();    
  }
  return cachedReply;
}

// All strategy vaults are exported as "treasury",
// as any vault may own any tokens available on the chain.
// Create a mappping { chain_id: { owners: [address, address...]}}
// See arca/index.js for structure.
function buildTreasuryConfig(protocolTVLReply) {
  const strategies = protocolTVLReply.strategies;
  let chainIdOwnersMap = {}
  for (const strat of Object.values(strategies)) {
    const chainId = strat.chain_id;

    if(!chainId) {
      // Unsupported/fancy chain
      continue;
    }

    const chainName = chainNames[chainId];
    if(!chainName) {
      throw new Error(`Does not know DefiLlama chain name for chain id ${chainId}`);
    }
 
    let owners = chainIdOwnersMap[chainName]?.owners || [];
    owners.push(strat.address)
    chainIdOwnersMap[chainName] = {
      owners 
    }
  }
  return chainIdOwnersMap;
}

// Pull out "address" fuield of all StrategyTVL objects that match the chain id
function getChainStrategyVaultAddresses(protocolTVLReply, chainId, api, ethBlock, chainBlocks) {
    const strategyObjects = Object.values(protocolTVLReply.strategies).filter((strat) => strat.chain_id == chainId);
    return strategyObjects.map((strat) => strat.address)
}

// Calculate vault balances for all vaults on a specific chain holding any token
async function fetchVaultBalances(chainId, chainName, api, ethBlock, chainBlocks) {
  const protocolTVLReply = await fetchDataCached();  
  // console.log("reply", protocolTVLReply);
  const vaultAddresses = getChainStrategyVaultAddresses(protocolTVLReply)
  // console.log("Chain", chainId, "owners", vaultAddresses);
  const chainDefaultTokens = defaultTokens[chainName];
  // console.log("Default tokens", chainDefaultTokens);

  const sumTokensExportOptions = {
    owners: vaultAddresses,
    tokens: chainDefaultTokens,
  }
  //const results = await sumTokensExport(sumTokensExportOptions);
  //console.log("Results", results);
  //const resultResults = await results;
  //console.log("Results await", resultResults);
  const results = await sumTokens({ ...api, api, ...sumTokensExportOptions });
  return results;
}


module.exports = {
    polygon: {
      tvl: async (api, ethBlock, chainBlocks) => { 
        return await fetchVaultBalances(137, "polygon", api, ethBlock, chainBlocks) 
      }
    }
}
