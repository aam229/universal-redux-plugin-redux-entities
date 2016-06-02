export const COLLECTIONS_KEY = 'collections';
export const ITEMS_KEY = 'items';
export const ENTITIES_REDUCER = 'entities';

export function isEntityExpired(state, type, id, isCollection, expiresSeconds){
  if(!expiresSeconds){
    return false;
  }
  const meta = getEntityMetadata(state, type, id, isCollection);
  if(!meta){
    return true;
  }
  return ( meta.lastUpdate + expiresSeconds * 1000) < Date.now();
}

export function getEntityMetadata(state, type, id, isCollection = false){
  const entity = getEntity(state, type, id, isCollection);
  return entity ? entity.metadata : null;
}

export function getItemData(state, type, id){
  return getEntityData(state, type, id, false);
}

export function getCollectionData(state, type, id){
  return getEntityData(state, type, id, true);
}

export function getEntitiesData(state, type, ids){
  return ids.map((i) => getEntityData(state, type, i));
}

export function getEntityData(state, type, id, isCollection = false) {
  const entity = getEntity(state, type, id, isCollection);
  if(!entity){
    return null;
  }
  return isCollection ? entity.data.map((i) => getEntityData(state, type, i)) : entity.data ;
}

export function getEntity(state, type, id, isCollection = false){
  if(state[ENTITIES_REDUCER]){
    state = state[ENTITIES_REDUCER];
  }
  const key = isCollection ? COLLECTIONS_KEY : ITEMS_KEY;
  if (!state[type] || !state[type][key] || !state[type][key][id]){
    return null;
  }
  return state[type][key][id];
}