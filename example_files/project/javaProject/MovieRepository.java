package application;

import java.util.ArrayList;
import java.util.List;

public class MovieRepository {
    private List<Movies> movies;

    public MovieRepository() {
        this.movies = new ArrayList<>();
    }

    public void addMovie(Movies movie) {
        movies.add(movie);
    }

    public void removeMovie(Movies movie) {
        movies.remove(movie);
    }

    public Movies findMovieById(long id) {
        for (Movies movie : movies) {
            if (movie.getId() == id) {
                return movie;
            }
        }
        return null;
    }

    public Movies findMovieByTitle(String title) {
        for (Movies movie : movies) {
            if (movie.getMovieName().equalsIgnoreCase(title)) {
                return movie;
            }
        }
        return null;
    }

    public List<Movies> getAllMovies() {
        return new ArrayList<>(movies);
    }

    public List<Movies> searchByGenre(String genre) {
        List<Movies> result = new ArrayList<>();
        for (Movies movie : movies) {
            if (movie.getMovieGenre().equalsIgnoreCase(genre)) {
                result.add(movie);
            }
        }
        return result;
    }

    public void updateMovie(Movies movie) {
        for (int i = 0; i < movies.size(); i++) {
            if (movies.get(i).getId() == movie.getId()) {
                movies.set(i, movie);
                break;
            }
        }
    }

    public int count() {
        return movies.size();
    }
}