package application;

public class ShowsControler {
	private String MovieName;
	private String Show;
	private int showtime;
	private int price;

	public ShowsControler(String MovieName, String Show, int showtime, int price) {
		this.MovieName = MovieName;
		this.Show = Show;
		this.showtime = showtime;
		this.price = price;
	}

	public String getMovieName() {
		return MovieName;
	}

	public void setMovieName(String MovieName) {
		this.MovieName = MovieName;
	}

	public String getShow() {
		return Show;
	}

	public void setShow(String Show) {
		this.Show = Show;
	}

	public int getShowtime() {
		return showtime;
	}

	public void setShowtime(int showtime) {
		this.showtime = showtime;
	}

	public int getPrice() {
		return price;
	}

	public void setPrice(int price) {
        this.price = price;
    
	}
}
