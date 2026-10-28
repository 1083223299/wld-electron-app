/**
 * 游戏类型对应的价格类型编码映射
 */
const TYPE_CODES = {
  honor: { paiwei: 'RANK', power: 'HERO_POWER', peak: 'PEAK' },
  delta: {
    hafu: 'HAVCOIN',
    safeBox: 'HAVCOIN',
    escort: 'ESCORT',
    escortPeople: 'ESCORT',
    escortOption: 'ESCORT',
    escortMaps: 'ESCORT',
    prop: 'PROP',
    title: 'TITLE',
    safe3: 'SEASON_SAFE',
    taskPack: 'SEASON_SAFE',
    taskList: 'SEASON_SAFE',
    fun: 'FUN',
  },
  league: { ranked: 'RANK', placement: 'PLACEMENT' },
  valorant: {
    paiwei: 'RANK',
    dingwei: 'PLACEMENT',
    pass: 'BATTLE_PASS',
    contract: 'HERO_CONTRACT',
  },
};

// 页面使用更易读的字段名，提交时再映射为后端正式的 typeCode / fieldCode。
const EMPTY_CONFIG = {
  honor: {
    paiweiRanges: [], paiweiFallback: '', markupHero: '', markupPosition: '',
    powerRankRanges: [], powerRankFallback: '', powerRanges: [], powerFallback: '',
    peakRanges: [], peakFallback: '', scoreMarkupHero: '',
  },
  delta: {
    hafuModes: {
      跑刀: { min: '', max: '', start: '', per1m: '', safeBox: {} },
      撞车: { min: '', max: '', start: '', per1m: '', safeBox: {} },
    },
    escortModes: {
      手游: {
        escortPeople: {}, matMin: '', matMax: '', matStart: '', matPer1m: '',
        smMin: '', smMax: '', smStart: '', smPer: '',
        duration: {}, red: {}, itemsA: {}, maps: {}, mapDimensions: {}, clear: {},
      },
      端游: {
        escortPeople: {}, matMin: '', matMax: '', matStart: '', matPer1m: '',
        smMin: '', smMax: '', smStart: '', smPer: '',
        duration: {}, red: {}, itemsA: {}, maps: {}, mapDimensions: {}, clear: {},
      },
    },
    itemsB: {},
    title: {}, taskPack: {}, taskList: {},
  },
  league: {
    rankedRanges: [], rankedFallback: '', placementRanges: [], placementFallback: '', placementSeasons: [],
  },
  valorant: {
    paiweiRanges: [], paiweiFallback: '', placementPrice: { perMatch: '' },
    passPrice: { perLevel: '', fallbackPerLevel: '' },
    contractPrice: { perLevel: '', fallbackPerLevel: '' },
  },
};

// 原型和接口契约不一致的价目行不交给表单托管，避免全量替换时覆盖或删除原始数据。
const MANAGED_FIELDS = {
  honor: {
    RANK: ['RANK_SPAN', 'RANK_FALLBACK', 'SURCHARGE_PCT'],
    HERO_POWER: ['RANK_SPAN', 'RANK_FALLBACK', 'POWER_PER_1', 'POWER_PER_1000'],
    PEAK: ['PEAK_PER_1', 'PEAK_PER_100', 'SURCHARGE_PCT'],
  },
  delta: {
    HAVCOIN: ['HAVCOIN_BASE', 'HAVCOIN_PER_100W', 'HAVCOIN_GRID'],
    ESCORT: [
      'ESCORT_ACCUM', 'ESCORT_ACCUM_PER_100W', 'ESCORT_SINGLE_BASE', 'ESCORT_SINGLE_PER_50W',
      'ESCORT_HOUR', 'ESCORT_MAP', 'ESCORT_PERSON', 'ESCORT_RED', 'ESCORT_ITEM',
    ],
    PROP: ['PROP_ITEM'],
    TITLE: ['TITLE_FIXED'],
    SEASON_SAFE: ['SAFE_PACK', 'SAFE_TASK'],
  },
  league: {
    RANK: ['RANK_SPAN', 'RANK_FALLBACK'],
    PLACEMENT: ['RANK_SPAN', 'RANK_FALLBACK', 'PLACEMENT_SEASON'],
  },
  valorant: {
    RANK: ['RANK_SPAN', 'RANK_FALLBACK'],
    PLACEMENT: ['PLACEMENT_PER_MATCH'],
    BATTLE_PASS: ['BP_PER_LEVEL'],
    HERO_CONTRACT: ['CONTRACT_PER_LEVEL', 'CONTRACT_FALLBACK'],
  },
};

// 未确认的价目编码禁止新增，避免全量替换接口写入后端不支持的数据。
const UNCONFIRMED_FIELDS = new Set([
  'POWER_RANK_SPAN', 'POWER_RANK_FALLBACK', 'POWER_SPAN', 'POWER_FALLBACK',
  'PEAK_SPAN', 'PEAK_FALLBACK',
]);

const numberOrEmpty = (value) => (value === '' || value == null || Number.isNaN(Number(value)) ? '' : Number(value));
/**
 * 检查值是否为有效值
 * @param {any} value - 需要检查的值
 * @returns {boolean} - 如果值有效返回true，否则返回false
 */
/**
 * 检查值是否为有效值
 * @param {any} value - 需要检查的值
 * @returns {boolean} 如果值有效则返回true，否则返回false
 */
const hasValue = (value) => value !== '' && value != null && !Number.isNaN(Number(value));

/**
 * 解析维度JSON数据
 * @param {Object} row - 包含维度JSON数据的行对象
 * @returns {Object} - 返回解析后的维度对象，解析失败时返回空对象
 */
function parseDimensions(row) {
  // 检查行对象中是否存在dimJson属性，不存在则返回空对象
  if (!row.dimJson) return {};
  try {
    // 判断dimJson是否为字符串类型，如果是则解析JSON，否则直接返回
    return typeof row.dimJson === 'string' ? JSON.parse(row.dimJson) : row.dimJson;
  } catch {
    // JSON解析失败时返回空对象
    return {};
  }
}

function rangeRows(rows, fieldCode) {
  // 区间价只读取非兜底行；兜底价格由 fallbackValue 单独处理。
  return rows
    .filter((row) => row.fieldCode === fieldCode && !Number(row.fallback))
    .map((row) => ({
      start: row.fromKey ?? '',
      end: row.toKey ?? '',
      price: numberOrEmpty(row.amount),
    }));
}

function fallbackValue(rows, fieldCode) {
  const row = rows.find((item) => item.fieldCode === fieldCode && Number(item.fallback));
  return numberOrEmpty(row?.amount);
}

function valueFor(rows, fieldCode, predicate = () => true) {
  const row = rows.find((item) => item.fieldCode === fieldCode && predicate(item));
  return numberOrEmpty(row?.amount ?? row?.percent);
}

function normalizeDeltaPlatform(value) {
  if (value === 'mobile' || value === '手游') return '手游';
  if (value === 'pc' || value === '端游') return '端游';
  return '';
}

// 接口 percent 使用小数倍率（0.2 表示 20%），表单按百分数展示。
function percentFor(rows, predicate) {
  const value = valueFor(rows, 'SURCHARGE_PCT', predicate);
  return value === '' ? '' : Number((value * 100).toFixed(2));
}

function setValue(target, key, value) {
  if (value !== '') target[key] = value;
}

function mapTypeRows(gameKey, typeCode, rows, data) {
  // API 价目反向映射到各游戏模板的表单模型，不在这里推导接口未定义的价格算法。
  if (gameKey === 'honor') {
    if (typeCode === 'RANK') {
      data.paiweiRanges = rangeRows(rows, 'RANK_SPAN');
      setValue(data, 'paiweiFallback', fallbackValue(rows, 'RANK_FALLBACK'));
      setValue(data, 'markupHero', percentFor(rows, (row) => row.fromKey === 'HERO'));
      setValue(data, 'markupPosition', percentFor(rows, (row) => row.fromKey === 'LANE'));
    } else if (typeCode === 'HERO_POWER') {
      data.powerRankRanges = rangeRows(rows, 'RANK_SPAN');
      setValue(data, 'powerRankFallback', fallbackValue(rows, 'RANK_FALLBACK'));
      data.powerRanges = rangeRows(rows, 'POWER_PER_1');
      setValue(data, 'powerFallback', fallbackValue(rows, 'POWER_PER_1'));
    } else if (typeCode === 'PEAK') {
      data.peakRanges = rangeRows(rows, 'PEAK_PER_1');
      setValue(data, 'peakFallback', fallbackValue(rows, 'PEAK_PER_1'));
      setValue(data, 'scoreMarkupHero', percentFor(rows, (row) => row.fromKey === 'HERO'));
    }
    return;
  }

  if (gameKey === 'league') {
    if (typeCode === 'RANK') {
      data.rankedRanges = rangeRows(rows, 'RANK_SPAN');
      setValue(data, 'rankedFallback', fallbackValue(rows, 'RANK_FALLBACK'));
    } else if (typeCode === 'PLACEMENT') {
      data.placementRanges = [
        ...rangeRows(rows, 'RANK_SPAN'),
        ...rows
        .filter((row) => row.fieldCode === 'PLACEMENT_SEASON')
        .map((row) => ({ start: row.fromKey ?? '', end: row.fromKey ?? '', price: numberOrEmpty(row.amount) })),
      ];
      setValue(data, 'placementFallback', fallbackValue(rows, 'RANK_FALLBACK'));
    }
    return;
  }

  if (gameKey === 'valorant') {
    if (typeCode === 'RANK') {
      data.paiweiRanges = rangeRows(rows, 'RANK_SPAN');
      setValue(data, 'paiweiFallback', fallbackValue(rows, 'RANK_FALLBACK'));
    } else if (typeCode === 'PLACEMENT') {
      setValue(data.placementPrice, 'perMatch', valueFor(rows, 'PLACEMENT_PER_MATCH'));
    } else if (typeCode === 'BATTLE_PASS') {
      const passRows = rows.filter((row) => row.fieldCode === 'BP_PER_LEVEL');
      const basePrice = valueFor(passRows, 'BP_PER_LEVEL', (row) => !Number(row.fallback));
      const fallbackPrice = fallbackValue(passRows, 'BP_PER_LEVEL');
      const legacyPrice = valueFor(passRows, 'BP_PER_LEVEL');
      setValue(data.passPrice, 'perLevel', basePrice === '' ? legacyPrice : basePrice);
      setValue(data.passPrice, 'fallbackPerLevel', fallbackPrice === '' ? (basePrice === '' ? legacyPrice : basePrice) : fallbackPrice);
    } else if (typeCode === 'HERO_CONTRACT') {
      const contractRows = rows.filter((row) => row.fieldCode === 'CONTRACT_PER_LEVEL');
      const basePrice = valueFor(contractRows, 'CONTRACT_PER_LEVEL', (row) => !Number(row.fallback));
      const contractFallback = fallbackValue(rows, 'CONTRACT_FALLBACK');
      const fallbackPrice = contractFallback === '' ? fallbackValue(contractRows, 'CONTRACT_PER_LEVEL') : contractFallback;
      const legacyPrice = valueFor(contractRows, 'CONTRACT_PER_LEVEL');
      setValue(data.contractPrice, 'perLevel', basePrice === '' ? legacyPrice : basePrice);
      setValue(data.contractPrice, 'fallbackPerLevel', fallbackPrice === '' ? (basePrice === '' ? legacyPrice : basePrice) : fallbackPrice);
    }
    return;
  }

/**
 * 根据字段代码过滤行数据
 * @param {string} fieldCode - 字段代码，用于筛选匹配的行
 * @returns {Array} 返回过滤后的行数组，包含所有匹配指定fieldCode的行
 */
/**
 * 根据字段代码过滤数据行
 * @param {string} fieldCode - 需要过滤的字段代码
 * @returns {Array} 返回匹配字段代码的所有数据行
 */
  const byField = (fieldCode) => rows.filter((row) => row.fieldCode === fieldCode);
  const amountMap = (source, keyFor) => Object.fromEntries(
    source.map((row) => [keyFor(row), numberOrEmpty(row.amount)]).filter(([, value]) => value !== ''),
  );
  if (typeCode === 'HAVCOIN') {
    for (const mode of ['跑刀', '撞车']) {
      const modeData = data.hafuModes[mode];
      const base = rows.find((row) => row.fieldCode === 'HAVCOIN_BASE' && parseDimensions(row).mode === mode);
      if (base) {
        setValue(modeData, 'min', numberOrEmpty(base.fromKey));
        setValue(modeData, 'max', numberOrEmpty(base.toKey));
        setValue(modeData, 'start', numberOrEmpty(base.amount));
      }
      setValue(modeData, 'per1m', valueFor(rows, 'HAVCOIN_PER_100W', (row) => parseDimensions(row).mode === mode));
      modeData.safeBox = amountMap(
        byField('HAVCOIN_GRID').filter((row) => {
          const dimensions = parseDimensions(row);
          return dimensions.mode === mode && ['2', '4', '6', '9'].includes(String(dimensions.grid || row.toKey));
        }),
        (row) => `g${parseDimensions(row).grid || row.toKey}`,
      );
    }
  } else if (typeCode === 'ESCORT') {
    const mapRows = byField('ESCORT_MAP').filter((row) => ({
      不限: true, 巴克什: true, 航天基地: true, 潮汐监狱: true,
    }[row.fromKey]));
    for (const platform of ['手游', '端游']) {
      const modeData = data.escortModes[platform];
      const legacyRows = rows.filter((row) => {
        const rowPlatform = parseDimensions(row).platform;
        return rowPlatform == null || rowPlatform === '';
      });
      const platformRows = rows.filter((row) => normalizeDeltaPlatform(parseDimensions(row).platform) === platform);
      const mergedRows = [...legacyRows, ...platformRows];
      const accum = platformRows.find((row) => row.fieldCode === 'ESCORT_ACCUM')
        || legacyRows.find((row) => row.fieldCode === 'ESCORT_ACCUM');
      if (accum) {
        setValue(modeData, 'matMin', numberOrEmpty(accum.fromKey));
        setValue(modeData, 'matMax', numberOrEmpty(accum.toKey));
        setValue(modeData, 'matStart', numberOrEmpty(accum.amount));
      }
      const platformAccumPrice = valueFor(platformRows, 'ESCORT_ACCUM_PER_100W');
      setValue(
        modeData,
        'matPer1m',
        platformAccumPrice !== '' ? platformAccumPrice : valueFor(legacyRows, 'ESCORT_ACCUM_PER_100W'),
      );
      const singleBase = platformRows.find((row) => row.fieldCode === 'ESCORT_SINGLE_BASE')
        || legacyRows.find((row) => row.fieldCode === 'ESCORT_SINGLE_BASE');
      if (singleBase) {
        setValue(modeData, 'smMin', numberOrEmpty(singleBase.fromKey));
        setValue(modeData, 'smMax', numberOrEmpty(singleBase.toKey));
        setValue(modeData, 'smStart', numberOrEmpty(singleBase.amount));
      }
      const platformSinglePrice = valueFor(platformRows, 'ESCORT_SINGLE_PER_50W');
      setValue(modeData, 'smPer', platformSinglePrice !== '' ? platformSinglePrice : valueFor(legacyRows, 'ESCORT_SINGLE_PER_50W'));
      modeData.escortPeople = amountMap(
        mergedRows.filter((row) => row.fieldCode === 'ESCORT_PERSON'),
        (row) => ({ 单护: 'danhu', 双护: 'shuanghu', 一拖二: 'yituoer' }[row.fromKey] || row.fromKey),
      );
      modeData.duration = amountMap(mergedRows.filter((row) => row.fieldCode === 'ESCORT_HOUR'), () => 'hour1');
      modeData.red = amountMap(mergedRows.filter((row) => row.fieldCode === 'ESCORT_RED'), () => 'dahong');
      modeData.itemsA = amountMap(
        mergedRows.filter((row) => row.fieldCode === 'ESCORT_ITEM'),
        (row) => ({
          非洲之星: 'fzzx', 卫星锅: 'wxg', 火箭燃料: 'hjrl', 浮力设备: 'flsb',
          卫星通讯天线: 'wxtx', 高级咖啡豆: 'gjkf', 天圆地方: 'tydf', 纵横: 'zh',
        }[row.fromKey] || row.fromKey),
      );
      modeData.maps = amountMap(
        mergedRows.filter((row) => row.fieldCode === 'ESCORT_MAP' && mapRows.includes(row)),
        (row) => ({
          不限: 'all', 巴克什: 'bashike', 航天基地: 'hangtian', 潮汐监狱: 'chaoxi',
        }[row.fromKey] || row.fromKey),
      );
      modeData.mapDimensions = {};
      mergedRows.filter((row) => row.fieldCode === 'ESCORT_MAP' && mapRows.includes(row)).forEach((row) => {
        const key = ({
          不限: 'all', 巴克什: 'bashike', 航天基地: 'hangtian', 潮汐监狱: 'chaoxi',
        }[row.fromKey] || row.fromKey);
        modeData.mapDimensions[key] = parseDimensions(row);
      });
      const platformClearPrice = valueFor(platformRows, 'ESCORT_CLEAR');
      setValue(modeData.clear, 'price', platformClearPrice !== '' ? platformClearPrice : valueFor(legacyRows, 'ESCORT_CLEAR'));
    }
  } else if (typeCode === 'PROP') {
    data.itemsB = amountMap(byField('PROP_ITEM'), (row) => ({
      卫星通讯天线: 'wxtx', 高级咖啡豆: 'gjkf', 火箭燃料: 'hjrl2', 天圆地方: 'tydf', 纵横: 'zh',
    }[row.fromKey] || row.fromKey));
  } else if (typeCode === 'TITLE') {
    setValue(data.title, 'tjsn', valueFor(rows, 'TITLE_FIXED'));
  } else if (typeCode === 'SEASON_SAFE') {
    setValue(data.taskPack, 'perTask', valueFor(rows, 'SAFE_PACK'));
    data.taskList = amountMap(byField('SAFE_TASK'), (row) => ({
      '第一阶段任务': 'stage1',
      '第二阶段任务': 'stage2',
      '第三阶段任务': 'stage3',
      '第四阶段任务': 'stage4',
      '9格保险包损耗': 'baosun',
      '征服标杆': 'fgbf',
      '终局联系': 'zjll',
      '勤俭持家': 'qjcj',
    }[row.fromKey] || row.fromKey));
  }
}

export function getTypeCode(gameKey, section) {
  return TYPE_CODES[gameKey]?.[section] || '';
}

export function migrateLegacyHonorPriceRows(typeCode, rows = []) {
  const legacyFields = {
    HERO_POWER: { fieldCode: 'POWER_PER_1000', replacement: 'POWER_PER_1', divisor: 1000 },
    PEAK: { fieldCode: 'PEAK_PER_100', replacement: 'PEAK_PER_1', divisor: 100 },
  };
  const migration = legacyFields[typeCode];
  if (!migration) return { rows, migratedCount: 0, invalidRows: [], conflicts: [] };

  const legacyRows = rows.filter((row) => row.fieldCode === migration.fieldCode);
  const normalizedRows = rows.filter((row) => row.fieldCode !== migration.fieldCode);
  const invalidRows = [];
  const conflicts = [];

  for (const row of legacyRows) {
    if (row.amount == null || row.amount === '' || !Number.isFinite(Number(row.amount))) {
      invalidRows.push(row);
      normalizedRows.push(row);
      continue;
    }

    const fromKey = row.fromKey ?? '';
    const toKey = row.toKey ?? '';
    const hasFromKey = fromKey !== '';
    const hasToKey = toKey !== '';
    if (!Number(row.fallback) && hasFromKey !== hasToKey) {
      invalidRows.push(row);
      normalizedRows.push(row);
      continue;
    }

    const fallback = Boolean(Number(row.fallback) || (!hasFromKey && !hasToKey));
    const migratedRow = {
      ...row,
      fieldCode: migration.replacement,
      amount: Number(row.amount) / migration.divisor,
      fromKey: fallback ? '' : fromKey,
      toKey: fallback ? '' : toKey,
      fallback: fallback ? 1 : 0,
    };
    const modernRow = normalizedRows.find((candidate) =>
      candidate.fieldCode === migration.replacement
      && priceRowIdentity(candidate) === priceRowIdentity(migratedRow));

    if (modernRow) {
      if (!samePrice(modernRow.amount, migratedRow.amount)) {
        conflicts.push({ legacy: row, current: modernRow, migratedAmount: migratedRow.amount });
      }
      continue;
    }
    normalizedRows.push(migratedRow);
  }

  return { rows: normalizedRows, migratedCount: legacyRows.length, invalidRows, conflicts };
}

export function mapGamePrices(gameKey, typeRecords, priceRowsByType) {
  const data = structuredClone(EMPTY_CONFIG[gameKey] || {});
  const rowsByType = {};
  for (const type of typeRecords) {
    const sourceRows = priceRowsByType[type.typeCode] || [];
    const rows = gameKey === 'honor'
      ? migrateLegacyHonorPriceRows(type.typeCode, sourceRows).rows
      : sourceRows;
    rowsByType[type.typeCode] = rows;
    mapTypeRows(gameKey, type.typeCode, rows, data);
  }
  return { data, rowsByType };
}

function priceLine(gameId, typeCode, fieldCode, values = {}) {
  return {
    gameId,
    typeCode,
    fieldCode,
    fromKey: values.fromKey ?? '',
    toKey: values.toKey ?? '',
    dimJson: values.dimJson ?? '',
    amount: values.amount ?? null,
    percent: values.percent ?? null,
    fallback: values.fallback ? 1 : 0,
  };
}

function buildTypeRows(gameKey, gameId, typeCode, data) {
  const out = [];
  const addRange = (fieldCode, ranges = []) => {
    ranges.forEach((range) => {
      if (range.start !== '' && range.end !== '' && hasValue(range.price)) {
        out.push(priceLine(gameId, typeCode, fieldCode, {
          fromKey: range.start, toKey: range.end, amount: Number(range.price),
        }));
      }
    });
  };
  const addFallback = (fieldCode, value) => {
    if (hasValue(value)) out.push(priceLine(gameId, typeCode, fieldCode, { amount: Number(value), fallback: true }));
  };
  const addAmount = (fieldCode, value, values = {}) => {
    if (hasValue(value)) out.push(priceLine(gameId, typeCode, fieldCode, { ...values, amount: Number(value) }));
  };
  const addPercent = (fromKey, value) => {
    // 表单按百分数录入，接口 percent 保存为小数倍率；fromKey 表示加价维度。
    if (hasValue(value)) out.push(priceLine(gameId, typeCode, 'SURCHARGE_PCT', { fromKey, percent: Number(value) / 100 }));
  };

  if (gameKey === 'honor') {
    if (typeCode === 'RANK') {
      addRange('RANK_SPAN', data.paiweiRanges);
      addFallback('RANK_FALLBACK', data.paiweiFallback);
      addPercent('HERO', data.markupHero);
      addPercent('LANE', data.markupPosition);
    } else if (typeCode === 'HERO_POWER') {
      addRange('RANK_SPAN', data.powerRankRanges);
      addFallback('RANK_FALLBACK', data.powerRankFallback);
      addRange('POWER_PER_1', data.powerRanges);
      addFallback('POWER_PER_1', data.powerFallback);
    } else if (typeCode === 'PEAK') {
      addRange('PEAK_PER_1', data.peakRanges);
      addFallback('PEAK_PER_1', data.peakFallback);
      addPercent('HERO', data.scoreMarkupHero);
    }
    return out;
  }

  if (gameKey === 'league') {
    if (typeCode === 'RANK') {
      addRange('RANK_SPAN', data.rankedRanges);
      addFallback('RANK_FALLBACK', data.rankedFallback);
    } else {
      const seasons = new Set(data.placementSeasons || []);
      const seasonRows = data.placementRanges.filter((row) => row.start === row.end && seasons.has(row.start));
      const rankRanges = data.placementRanges.filter((row) => !(row.start === row.end && seasons.has(row.start)));
      addRange('RANK_SPAN', rankRanges);
      seasonRows.forEach((row) => {
        out.push(priceLine(gameId, typeCode, 'PLACEMENT_SEASON', {
          fromKey: row.start,
          amount: Number(row.price),
        }));
      });
      addFallback('RANK_FALLBACK', data.placementFallback);
    }
    return out;
  }

  if (gameKey === 'valorant') {
    if (typeCode === 'RANK') {
      addRange('RANK_SPAN', data.paiweiRanges);
      addFallback('RANK_FALLBACK', data.paiweiFallback);
    } else if (typeCode === 'PLACEMENT') {
      addAmount('PLACEMENT_PER_MATCH', data.placementPrice?.perMatch);
    } else if (typeCode === 'BATTLE_PASS') {
      if (hasValue(data.passPrice?.perLevel)) {
        out.push(priceLine(gameId, typeCode, 'BP_PER_LEVEL', {
          fromKey: '1',
          toKey: '100',
          amount: Number(data.passPrice.perLevel),
        }));
      }
      if (hasValue(data.passPrice?.fallbackPerLevel)) {
        out.push(priceLine(gameId, typeCode, 'BP_PER_LEVEL', {
          amount: Number(data.passPrice.fallbackPerLevel),
          fallback: true,
        }));
      }
    } else if (typeCode === 'HERO_CONTRACT') {
      if (hasValue(data.contractPrice?.perLevel)) {
        out.push(priceLine(gameId, typeCode, 'CONTRACT_PER_LEVEL', {
          fromKey: '1',
          toKey: '100',
          amount: Number(data.contractPrice.perLevel),
        }));
      }
      if (hasValue(data.contractPrice?.fallbackPerLevel)) {
        out.push(priceLine(gameId, typeCode, 'CONTRACT_FALLBACK', {
          amount: Number(data.contractPrice.fallbackPerLevel),
          fallback: true,
        }));
      }
    }
    return out;
  }

  const addMap = (fieldCode, valueMap, keyMap, dimensions = {}, perKeyDimensions = {}) => {
    for (const [key, value] of Object.entries(valueMap || {})) {
      if (hasValue(value)) {
        const label = keyMap[key] || key;
        const rowDimensions = { ...(perKeyDimensions[key] ?? dimensions) };
        if (gameKey === 'delta' && typeCode === 'ESCORT') {
          rowDimensions.platform = normalizeDeltaPlatform(rowDimensions.platform) || dimensions.platform;
        }
        out.push(priceLine(gameId, typeCode, fieldCode, {
          fromKey: label,
          amount: Number(value),
          dimJson: Object.keys(rowDimensions).length ? JSON.stringify(rowDimensions) : '',
        }));
      }
    }
  };

  if (typeCode === 'HAVCOIN') {
    for (const mode of ['跑刀', '撞车']) {
      const modeData = data.hafuModes[mode];
      if ([modeData.min, modeData.max, modeData.start].every(hasValue)) {
        out.push(priceLine(gameId, typeCode, 'HAVCOIN_BASE', {
          fromKey: String(modeData.min),
          toKey: String(modeData.max),
          dimJson: JSON.stringify({ mode }),
          amount: Number(modeData.start),
        }));
      }
      addAmount('HAVCOIN_PER_100W', modeData.per1m, { dimJson: JSON.stringify({ mode }) });
      addMap('HAVCOIN_GRID', modeData.safeBox, {}, { mode });
    }
    out.filter((row) => row.fieldCode === 'HAVCOIN_GRID').forEach((row) => {
      row.toKey = String(row.fromKey).replace(/^g/, '');
      const mode = JSON.parse(row.dimJson).mode;
      row.dimJson = JSON.stringify({ mode, grid: row.toKey });
      row.fromKey = '';
    });
  } else if (typeCode === 'ESCORT') {
    for (const platform of ['手游', '端游']) {
      const modeData = data.escortModes?.[platform] || {};
      const dimensions = { platform };
      if ([modeData.matMin, modeData.matMax, modeData.matStart].every(hasValue)) {
        out.push(priceLine(gameId, typeCode, 'ESCORT_ACCUM', {
          fromKey: String(modeData.matMin), toKey: String(modeData.matMax),
          dimJson: JSON.stringify(dimensions), amount: Number(modeData.matStart),
        }));
      }
      addAmount('ESCORT_ACCUM_PER_100W', modeData.matPer1m, { dimJson: JSON.stringify(dimensions) });
      if ([modeData.smMin, modeData.smMax, modeData.smStart].every(hasValue)) {
        out.push(priceLine(gameId, typeCode, 'ESCORT_SINGLE_BASE', {
          fromKey: String(modeData.smMin), toKey: String(modeData.smMax),
          dimJson: JSON.stringify(dimensions), amount: Number(modeData.smStart),
        }));
      }
      addAmount('ESCORT_SINGLE_PER_50W', modeData.smPer, { dimJson: JSON.stringify(dimensions) });
      addMap('ESCORT_PERSON', modeData.escortPeople, { danhu: '单护', shuanghu: '双护', yituoer: '一拖二' }, dimensions);
      addAmount('ESCORT_HOUR', modeData.duration?.hour1, { dimJson: JSON.stringify(dimensions) });
      addAmount('ESCORT_RED', modeData.red?.dahong, { dimJson: JSON.stringify(dimensions) });
      addMap(
        'ESCORT_MAP',
        modeData.maps,
        { all: '不限', bashike: '巴克什', hangtian: '航天基地', chaoxi: '潮汐监狱' },
        dimensions,
        modeData.mapDimensions,
      );
      addMap('ESCORT_ITEM', {
        fzzx: modeData.itemsA?.fzzx,
        wxg: modeData.itemsA?.wxg,
        hjrl: modeData.itemsA?.hjrl,
        flsb: modeData.itemsA?.flsb,
      }, {
        fzzx: '非洲之星', wxg: '卫星锅', hjrl: '火箭燃料', flsb: '浮力设备',
      }, dimensions);
    }
  } else if (typeCode === 'PROP') {
    addMap('PROP_ITEM', data.itemsB, {
      wxtx: '卫星通讯天线', gjkf: '高级咖啡豆', hjrl2: '火箭燃料', tydf: '天圆地方', zh: '纵横',
    });
  } else if (typeCode === 'TITLE') {
    addMap('TITLE_FIXED', data.title, { tjsn: '天才少年' });
  } else if (typeCode === 'SEASON_SAFE') {
    addAmount('SAFE_PACK', data.taskPack?.perTask);
    addMap('SAFE_TASK', data.taskList, {
      baosun: '9格保险包损耗', stage1: '第一阶段任务', stage2: '第二阶段任务',
      stage3: '第三阶段任务', stage4: '第四阶段任务', fgbf: '征服标杆',
      zjll: '终局联系', qjcj: '勤俭持家',
    });
  }
  return out;
}

export function buildPricePayload(gameKey, gameId, typeCode, data, existingRows = []) {
  // PUT 是全量替换；仅替换当前表单明确管理的行，其余接口原始行完整保留。
  const untouchedRows = existingRows
    .filter((row) => !isRowMappedToForm(gameKey, typeCode, row))
    .map(({ id, ...row }) => ({ ...row }));
  return [...untouchedRows, ...buildTypeRows(gameKey, gameId, typeCode, data)];
}

export function comparePriceRows(existingRows = [], nextRows = []) {
  const rowsByIdentity = new Map();
  nextRows.forEach((row) => {
    const identity = priceRowIdentity(row);
    const matches = rowsByIdentity.get(identity) || [];
    matches.push(row);
    rowsByIdentity.set(identity, matches);
  });

  const removed = [];
  const updated = [];
  existingRows.forEach((before) => {
    const matches = rowsByIdentity.get(priceRowIdentity(before));
    const after = matches?.shift();
    if (!after) {
      removed.push(before);
    } else if (!samePrice(before.amount, after.amount) || !samePrice(before.percent, after.percent)) {
      updated.push({ before, after });
    }
  });

  return {
    removed,
    updated,
    added: [...rowsByIdentity.values()].flat(),
  };
}

function priceRowIdentity(row) {
  let dimensions = row.dimJson ?? '';
  if (dimensions) {
    try {
      const parsed = typeof dimensions === 'string' ? JSON.parse(dimensions) : dimensions;
      dimensions = JSON.stringify(Object.fromEntries(
        Object.entries(parsed).sort(([left], [right]) => left.localeCompare(right)),
      ));
    } catch {
      dimensions = String(dimensions);
    }
  }
  return JSON.stringify([
    row.fieldCode,
    row.fromKey ?? '',
    row.toKey ?? '',
    dimensions,
    Number(row.fallback) || 0,
  ]);
}

function samePrice(left, right) {
  if (left == null || left === '') return right == null || right === '';
  if (right == null || right === '') return false;
  return Number.isNaN(Number(left)) || Number.isNaN(Number(right))
    ? String(left) === String(right)
    : Number(left) === Number(right);
}

export function findUnconfirmedFields(payload, existingRows = []) {
  const existingFields = new Set(existingRows.map((row) => row.fieldCode));
  return [...new Set(payload
    .map((row) => row.fieldCode)
    .filter((fieldCode) => UNCONFIRMED_FIELDS.has(fieldCode) && !existingFields.has(fieldCode)))];
}

function isRowMappedToForm(gameKey, typeCode, row) {
  const fieldCode = row.fieldCode;
  if (gameKey === 'honor' && ['POWER_PER_1000', 'PEAK_PER_100'].includes(fieldCode)) return false;
  if (!MANAGED_FIELDS[gameKey]?.[typeCode]?.includes(fieldCode)) return false;
  const key = row.fromKey || '';
  if (gameKey === 'honor' && fieldCode === 'SURCHARGE_PCT') {
    return typeCode === 'RANK'
      ? ['HERO', 'LANE'].includes(key)
      : typeCode === 'PEAK' && key === 'HERO';
  }
  if (gameKey === 'delta') {
    if (typeCode === 'HAVCOIN') {
      const dimensions = parseDimensions(row);
      if (!['跑刀', '撞车'].includes(dimensions.mode)) return false;
      if (fieldCode === 'HAVCOIN_GRID') return ['2', '4', '6', '9'].includes(String(dimensions.grid || row.toKey));
      return true;
    }
    if (typeCode === 'ESCORT') {
      const rawPlatform = parseDimensions(row).platform;
      if (rawPlatform != null && rawPlatform !== '' && !normalizeDeltaPlatform(rawPlatform)) return false;
      const knownMaps = ['不限', '巴克什', '航天基地', '潮汐监狱'];
      const knownPlayers = ['单护', '双护', '一拖二'];
      const prototypeItems = ['非洲之星', '卫星锅', '火箭燃料', '浮力设备'];
      if (fieldCode === 'ESCORT_ACCUM' || fieldCode === 'ESCORT_ACCUM_PER_100W' || fieldCode === 'ESCORT_SINGLE_BASE') return true;
      if (fieldCode === 'ESCORT_SINGLE_PER_50W' || fieldCode === 'ESCORT_RED') return true;
      if (fieldCode === 'ESCORT_MAP') {
        const platform = parseDimensions(row).platform;
        return knownMaps.includes(key)
          && ['mobile', 'pc', '手游', '端游'].includes(platform);
      }
      if (fieldCode === 'ESCORT_PERSON') return knownPlayers.includes(key);
      if (fieldCode === 'ESCORT_ITEM') return prototypeItems.includes(key);
      if (fieldCode === 'ESCORT_HOUR') return !key || key === '1小时';
      return true;
    }
    if (typeCode === 'PROP') return ['卫星通讯天线', '高级咖啡豆', '火箭燃料', '天圆地方', '纵横'].includes(key);
    if (typeCode === 'TITLE') return key === '天才少年';
    if (typeCode === 'SEASON_SAFE') {
      return (fieldCode === 'SAFE_PACK' && !key)
        || ['9格保险包损耗', '第一阶段任务', '第二阶段任务', '第三阶段任务', '第四阶段任务', '征服标杆', '终局联系', '勤俭持家'].includes(key);
    }
    return false;
  }
  if (gameKey === 'league' && typeCode === 'PLACEMENT') {
    return ['RANK_SPAN', 'RANK_FALLBACK', 'PLACEMENT_SEASON'].includes(fieldCode);
  }
  return true;
}

export function mapCatalogGames(response) {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.list)) return response.list;
  return [];
}

export function mapApiList(response) {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.list)) return response.list;
  return [];
}

export function findUnscopedDeltaEscortRows(rows = []) {
  const managedFields = new Set(MANAGED_FIELDS.delta.ESCORT);
  return rows.filter((row) =>
    managedFields.has(row.fieldCode)
    && (parseDimensions(row).platform == null || parseDimensions(row).platform === ''));
}
