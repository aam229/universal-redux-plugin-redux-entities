export const COLLECTIONS_KEY = 'collections';
export const ITEMS_KEY = 'items';


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

export function getEntityData(state, type, id, isCollection = false) {
  const entity = getEntity(state, type, id, isCollection);
  return entity ? entity.data : null;
}

export function getEntity(state, type, id, isCollection = false){
  const key = isCollection ? COLLECTIONS_KEY : ITEMS_KEY;
  if (!state[type] || !state[type][key] || !state[type][key][id]){
    return null;
  }
  return state[type][key][id];
}