import create, { StateCreator } from 'zustand/vanilla';
import { StoreApi } from 'zustand/vanilla';
import { devtools, persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

import { Injectable } from '@angular/core';
import { firstValueFrom, Observable } from 'rxjs';
import { MoviesDataService } from './movies.data-service';
import {
  initState,
  MovieAPI,
  MovieState,
  MovieViewModel,
  MovieComputedState,
  MovieItem,
  MovieStateWithAPI,
} from './movies.model';
import { computeMatchedMovies } from './movies.filters';
import { computed } from '../utils';
import { computeWith } from '../utils/computed';

@Injectable()
export class MoviesStore {
  vm$: Observable<MovieViewModel>;

  constructor(private movieAPI: MoviesDataService) {
    this.vm$ = this.makeStore();
  }

  private makeStore(): Observable<MovieViewModel> {
    const store: StoreApi<MovieViewModel> = buildStoreEngine(this.movieAPI);
    const { loadMovies, searchBy } = store.getState();

    loadMovies(searchBy);  // initial auto-load

    return new Observable((subscriber) => {
      const watchStore = (vm: MovieViewModel) => subscriber.next(vm);
      const stopWatching = store.subscribe(watchStore);
      
      return () => stopWatching();
    });
  }
}

// Create an instance of the Zustand store engine
function buildStoreEngine(
  movieAPI: MoviesDataService
): StoreApi<MovieViewModel> {
  /**
   * Calculate/build our derived/computed properties
   */
  const buildComputedFn = ({
    allMovies,
    filterBy,
  }: Partial<MovieStateWithAPI>): MovieComputedState => {
    const filteredMovies = computeMatchedMovies({ allMovies, filterBy });
    return { filteredMovies };
  };

  /**
   * Build a State/API store
   */
  const buildStoreFn = (set, get, store): MovieViewModel => {
    set = computeWith<MovieViewModel>(buildComputedFn, store);

    const data: MovieState = initState();
    const api: MovieAPI = {
      // Load movies based on searchBy and page
      loadMovies: async (searchBy: string, page = 1): Promise<boolean> => {
        const request$ = movieAPI.searchMovies<MovieItem[]>(searchBy, page);
        const allMovies = await firstValueFrom(request$);

        set({ allMovies, searchBy });
        return true;
      },
      // Filter movies and highlight matching text
      updateFilter: (filterBy: string) => {
        set({ filterBy });
      },
      // Show all available movies
      clearFilter: () => {
        set({ filterBy: '' });
      },
    };

    // For us, a store state is both 'data' + 'api'
    return {
      ...data,
      ...api,
      ...buildComputedFn(data),
    };
  };

  // Return entire MovieViewModel
  return create<MovieViewModel>()(
    // prettier-ignore
    devtools(
      persist(
        immer(buildStoreFn), 
        { name: 'movieSearch' }
      ),
      { name: 'movieSearch' }
    )
  );
}
