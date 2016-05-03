import { hooks, environments, positions, register } from 'universal-redux/lib/hooks';

import reducer, {
  ENTITIES_REDUCER
} from './reducer';

export * from './reducer';
export * from './utils';

register(hooks.CREATE_REDUX_REDUCER, function(data){
  return {
    ...data,
    reducers: {
      ...data.reducers,
      [ENTITIES_REDUCER]: reducer
    }
  } ;
}, {
  environments: [
    environments.CLIENT,
    environments.SERVER
  ],
  position: positions.BEFORE
});

