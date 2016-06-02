import {
  COLLECTIONS_KEY,
  ITEMS_KEY,
  isEntityExpired,
  getEntitiesData,
  getEntityData
} from './utils';

const EXPIRE_SECONDS = 60;

const FETCH_OPERATION = 'fetch';
const UPDATE_OPERATION = 'update';
const CREATE_OPERATION = 'create';
const DELETE_OPERATION = 'delete';

const PENDING_REQUESTS = new Map();

export const RECEIVE_ENTITY = 'entities/RECEIVE_ENTITY';
export const REQUEST_ENTITY = 'entities/REQUEST_ENTITY';

export default function reducer(state = {}, action = {}) {
  switch (action.type) {
    case RECEIVE_ENTITY:
      return {
        ...state,
        ...Object.keys(action.result.entities).reduce((types, entityType) => {
          types[entityType] = entityReducer(state[entityType], action, entityType);
          return types;
        }, {  })
      };
    case REQUEST_ENTITY:

    default:
      return state;
  }
}

function entityReducer(entityState = {}, action, entityType){
  return {
    [COLLECTIONS_KEY]: entityCollectionsReducer(entityState[COLLECTIONS_KEY], action, entityType),
    [ITEMS_KEY]: entityItemsReducer(entityState[ITEMS_KEY], action, entityType)
  }
}

function entityItemsReducer(entityItemsState = {}, action, entityType) {
  const itemsData = action.result.entities[entityType];
  return {
    ...entityItemsState,
    ...itemsData.reduce((entities, entityData) => {
      entities[entityData.id] = entityItemReducer(entityItemsState[entityData.id], action, entityData);
      return entities;
    }, {})
  }
}

function entityItemReducer(entityItemState = {}, action, entityData) {
  const metadata = {
    ...entityItemState.metadata,
    lastUpdate: new Date().getTime()
  };
  if (action.payload.operation === DELETE_OPERATION) {
    metadata.isDeleted = true;
  }
  return {
    metadata: metadata,
    data: entityData
  }
}

function entityCollectionsReducer(entityCollectionsState = {}, action, entityType) {
  if (!action.payload.collectionID || action.payload.collectionType !== entityType){
    return entityCollectionsState;
  }
  const collectionData = action.result.result;
  return {
    ...entityCollectionsState,
    [ action.payload.collectionID ]: {
      data: collectionData,
      metadata: {
        lastUpdate: new Date().getTime()
      }
    }
  }
}

export function createCollection(type, id, createPromise){
  return create(type, id, true, createPromise);
}

export function createItem(type, createPromise){
  return create(type, null, false, createPromise);
}

function create(type, id, isCollection, createPromise){
  return (dispatch, getState) => {
    // dispatch(createRequestAction(type, null, false, CREATE_OPERATION));
    return createPromise(dispatch, getState).then((result) => {
      dispatch(createReceiveAction(result, CREATE_OPERATION, isCollection ? type : null, isCollection ? id : null));

      return result.result instanceof Array ?
        getEntitiesData(getState(), type, result.result) :
        getEntityData(getState(), type, result.result);
    });
  }
}

export function createLocalItem(type, data) {
  return (dispatch, getState) => {
    dispatch(createReceiveAction(type, null, false, {
      entities: {
        [type] : [data]
      },
      result: data.id
    }, CREATE_OPERATION));
    return data.id;
  }
}

export function deleteCollection(type, id, createPromise){
  return remove(type, id, true, createPromise);
}

export function deleteItem(type, createPromise) {
  return remove(type, null, false, createPromise);
}

function remove(type, id, isCollection, createPromise){
  return (dispatch, getState) => {
    // dispatch(createRequestAction(type, id, false, DELETE_OPERATION));
    return createPromise(dispatch, getState).then((result) => {
      dispatch(createReceiveAction(result, DELETE_OPERATION, isCollection ? type : null, isCollection ? id : null));

      return result.result instanceof Array ?
        getEntitiesData(getState(), type, result.result) :
        getEntityData(getState(), type, result.result);
    });
  }
}

export function deleteLocalItem(type, id) {
  return (dispatch, getState) => {
    const result = {
      entities: {
        [type]: [{ id }]
      },
      result: id
    };
    dispatch(createReceiveAction(type, DELETE_OPERATION));
    return id;
  }
}

export function updateCollection(type, id, createPromise) {
  return update(type, id, true, createPromise);
}

export function updateItem(type, createPromise){
  return update(type, null, false, createPromise);
}

function update(type, id, isCollection, createPromise){
  return (dispatch, getState) => {
    // dispatch(createRequestAction(type, id, false, UPDATE_OPERATION));
    return createPromise(dispatch, getState).then((result) => {
      dispatch(createReceiveAction(result, UPDATE_OPERATION, isCollection ? type : null, isCollection ? id : null));

      return result.result instanceof Array ?
        getEntitiesData(getState(), type, result.result) :
        getEntityData(getState(), type, result.result);
    });
  }
}

export function fetchCollection(type, id, createPromise, options = {}){
  return fetch(type, id, true, createPromise, options);
}

export function fetchItem(type, id, createPromise, options = {}){
  return fetch(type, id, false, createPromise, options);
}

function fetch(type, id, isCollection, createPromise, {requestKey, expiresSeconds, force}) {
  const expiresSeconds = expiresSeconds || EXPIRE_SECONDS;
  requestKey = id ? getEntityKey(type, id, isCollection) : requestKey;

  return (dispatch, getState) => {
    const state = getState();
    if(requestKey && PENDING_REQUESTS.has(requestKey)){
      return PENDING_REQUESTS.get(requestKey)
    }
    if(id && !force && !isEntityExpired(state, type, id, isCollection, expiresSeconds)){
      return Promise.resolve(getEntityData(state, type, id, isCollection));
    }
    // dispatch(createRequestAction(type, id, isCollection, FETCH_OPERATION));
    const promise = createPromise(dispatch, getState)
      .then(
        (result) => {
          if(requestKey) PENDING_REQUESTS.delete(requestKey);

          dispatch(createReceiveAction(result, FETCH_OPERATION, isCollection ? type : null, isCollection ? id : null));
          return result.result instanceof Array ?
            getEntitiesData(getState(), type, result.result) :
            getEntityData(getState(), type, result.result);
        },
        (error) => {
          if(requestKey) PENDING_REQUESTS.delete(requestKey);
          throw error;
        }
      );

    if(requestKey) PENDING_REQUESTS.set(requestKey, promise);
    return promise;
  }
}

function createRequestAction(type, id, isCollection, operation){
  return {
    type: REQUEST_ENTITY,
    payload: { type, id, isCollection, operation}
  }
}

function createReceiveAction(result, operation, collectionType = null, collectionID = null){
  return {
    type: RECEIVE_ENTITY,
    payload: { operation, collectionType, collectionID},
    result
  }
}

function getEntityKey(type, id, isCollection){
  return `${type}-${id}-${isCollection ? 'collection' : 'item'}`;
}