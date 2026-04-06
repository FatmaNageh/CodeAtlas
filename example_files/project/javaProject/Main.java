package application;

import java.io.BufferedWriter;
import java.io.FileInputStream;
import java.io.FileNotFoundException;
import java.io.FileOutputStream;
import java.io.FileWriter;
import java.io.IOException;
import java.io.ObjectInputStream;
import java.io.ObjectOutputStream;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Date;
import java.util.HashMap;
import java.util.List;

import javafx.application.Application;
import javafx.collections.FXCollections;
import javafx.collections.ObservableList;
import javafx.event.EventHandler;
import javafx.geometry.Insets;
import javafx.geometry.Pos;
import javafx.stage.Stage;
import javafx.stage.StageStyle;
import javafx.scene.Group;
import javafx.scene.Scene;
import javafx.scene.control.Alert;
import javafx.scene.control.Alert.AlertType;
import javafx.scene.control.Button;
import javafx.scene.control.ChoiceBox;
import javafx.scene.control.ComboBox;
import javafx.scene.control.DatePicker;
import javafx.scene.control.Label;
import javafx.scene.control.PasswordField;
import javafx.scene.control.RadioButton;
import javafx.scene.control.TableColumn;
import javafx.scene.control.TableView;
import javafx.scene.control.TextField;
import javafx.scene.control.ToggleGroup;
import javafx.scene.control.cell.PropertyValueFactory;
import javafx.scene.image.Image;
import javafx.scene.image.ImageView;
import javafx.scene.input.KeyEvent;
import javafx.scene.layout.AnchorPane;
import javafx.scene.layout.GridPane;
import javafx.scene.layout.HBox;
import javafx.scene.layout.VBox;
import javafx.scene.paint.Color;
import javafx.scene.text.Font;
import javafx.scene.text.FontWeight;
import javafx.scene.text.Text;

public class Main extends Application {

	private double x = 0;
	private double y = 0;
	private long movieID = 0;
	private long showID = 0;
	private User u;

	private TableView<ShowsControler> gc;
	private ComboBox<String> hallComboBox;
	private ComboBox<String> seatComboBox;

	private Button signOutBtn = createButton("", 8.0, 792.0, 47.0, 62.0, "signout-btn");
	private Button exitButton = createButton("", 1285.0, 2.0, 25.0, 73.0, "close-btn");
	private Button minimizeButton = createButton("", 1210.0, 2.0, 25.0, 73.0, "minimize-btn");
	private Button moviesBtn = createButton("Movies", -1.0, 296.0, 47.0, 255.0, "nav-btn");
	private Button showsBtn = createButton("Shows", -1.0, 343.0, 47.0, 255.0, "nav-btn");
	private Button userBtn = createButton("Users", "", 390.0, 47.0, 255.0, "nav-btn");
	private Button viewReveBtn = createButton("View Revenue", -1.0, 437.0, 47.0, 255.0, "nav-btn");
	private Button viewBookBtn = createButton("View Booking", -1.0, 480.0, 47.0, 255.0, "nav-btn");
	private Label signOutTextLabel = createLabel("Sign Out", 82.0, 800.0, 32.0, 97.0, 16.0);
	// Movie Anchor Pain what's inside it
	private AnchorPane MoviesAnchorPane = createAnchorPane(255.0, 57.0, 861.0, 1080.0, true);
	private Label durationHourLabel = createLabel("Duration Hour:", 6.0, 475.0, 15.0);
	private Label durationMinLabel = createLabel("Duration Min:", 14.0, 524.0, 15.0);
	private Label publishedDateLabel = createLabel("Published Date:", 14.0, 584.0, 13.0);
	private Label movieNameLabel = createLabel("Movie Name:", 13.0, 311.0, 15.0);
	private Label moviePriceLabel = createLabel("Price:", 65.0, 353.0, 15.0);
	private Label genreLabel = createLabel("Genre:", 55.0, 436.0, 15.0);
	private Label directorLabel = createLabel("Director:", 42.0, 393.0, 15.0);
	private TextField movieNameTextField = createTextField(110.0, 309.0, 155.0, "add-textfield");
	private TextField moviePriceTextField = createTextField(111.0, 351.0, 155.0, "add-textfield");
	private TextField directorTextField = createTextField(111.0, 391.0, 25.0, 155.0, "add-textfield");
	private TextField genreTextField = createTextField(111.0, 432.0, 155.0, "add-textfield");
	private TextField durationHourTextField = createTextField(111.0, 471.0, 155.0, "add-textfield");
	private TextField durationMinTextField = createTextField(111.0, 520.0, 25.0, 155.0, "add-textfield");
	private TextField searchTextField = createTextField(17.0, 20.0, 25.0, 166.0, "search");
	private Button insertButton = createButton("Insert", 14.0, 639.0, "insert-btn");
	private Button updateButton = createButton("Update", 153.0, 639.0, "update-btn");
	private Button clearButton = createButton("Clear", 153.0, 724.0, "clear-btn");
	private Button deleteButton = createButton("Delete", 14.0, 724.0, "delete-btn");
	private TableView<Movies> tableView = new TableView<>();
	private TableColumn<Movies, Long> idColumn = new TableColumn<>("ID");
	private TableColumn<Movies, String> movieNameColumn = new TableColumn<>("Movie Name");
	private TableColumn<Movies, Integer> moviePriceColumn = new TableColumn<>("Price");
	private TableColumn<Movies, String> directorColumn = new TableColumn<>("Director");
	private TableColumn<Movies, String> genreColumn = new TableColumn<>("Genre");
	private TableColumn<Movies, String> durationColumn = new TableColumn<>("Duration");
	private TableColumn<Movies, Date> publishedDateColumn = new TableColumn<>("Published Date");
	private DatePicker publishedDatePicker = new DatePicker();

	// Show Anchor Pain what's inside it
	private Label showDayLabel = createLabel("Show Day:", 41.0, 531.0, 30.0, 73.0, 15.0);
	private Label showMonthLabel = createLabel("Show Month:", 19.0, 578.0, 30.0, 88.0, 15.0);
	private Label showTimeMinLabel = createLabel("Show Time Min:", 12.0, 485, 26.0, 14.0, 14.0);
	private Label showTimeHourLabel = createLabel("Show Time Hour:", 8.0, 442.0, 20.0, 108.0, 14.0);
	private Label moviePickedLabel = createLabel("Movie Picked:", 12.0, 304.0, 26.0, 99.0, 15.0);
	private Label showTicketPriceLabel = createLabel("Ticket Price:", 17.0, 351.0, 26.0, 91.0, 17.0);
	private Label showGenreLabel = createLabel("Genre:", 49.0, 393.0, 30.0, 57.0, 17.0);
	private TableView<Movies> moviesTableView = new TableView<>();
	private TableView<Shows> showsTableView = new TableView<>();
	private Button insertButton1 = createButton("Insert", 14.0, 639.0, "insert-btn");
	private Button updateButton1 = createButton("Update", 153.0, 639.0, "update-btn");
	private Button clearButton1 = createButton("Clear", 153.0, 724.0, "clear-btn");
	private Button deleteButton1 = createButton("Delete", 14.0, 724.0, "delete-btn");
	private TextField showSearchTextField = createSearchTextField(14.0, 18.0, "Search Show");
	private TextField showTimeMinTextField = createTextField(115.0, 481.0, 25.0, 155.0, "add-textfield");
	private TextField showDayTextField = createTextField(115.0, 527.0, 25.0, 155.0, "add-textfield");
	private TextField showTimeHourTextField = createTextField(115.0, 438.0, 29.0, 155.0, "add-textfield");
	private TextField moviePickedTextField = createTextField(113.0, 302.0, 29.0, 155.0, "add-textfield", false);
	private TextField showTicketPriceTextField = createTextField(113.0, 349.0, 29.0, 155.0, "add-textfield", false);
	private TextField showGenreTextField = createTextField(115.0, 393.0, 29.0, 155.0, "add-textfield", false);
	private TextField showMonthTextField = createTextField(115.0, 574.0, 25.0, 155.0, "add-textfield");
	private ImageView showSearchIconImageView = createSearchIconImageView(15.0, 18.0);
	private Button selectMovieButton = createButton("Select Movie", 25.0, 747.0, 294.0, "selectMovie-btn");
	private Button clearMovieButton = createButton("Clear Selection", 451.0, 747.0, 294.0, "clearMovie-btn");
	private TextField movieSearchTextField = createSearchTextField(579.0, 18.0, "Search Movie");
	private ImageView movieSearchIconImageView = createSearchIconImageView(579.0, 18.0);

	// private static final String moviesFile = "moviesData.bin";

	private Scene scene;
	private Scene edit_scene;
	private Scene search_scene;
	private Scene remove_scene;
	private Scene scene_search;

	private Stage Stage;
	private Scene scene1;
	private Scene sceneSignUp;
	private Scene sceneReceptionist;
	private Scene sceneGuest;
	private Scene sceneAdmin;
	private Scene guest;
	private  Scene Recepscene;
	private Scene guestInfoScene;

	Button btt = new Button("Add");
	Button btt2 = new Button("Remove");
	Button btt3 = new Button("Edit");
	Button btt4 = new Button("Search");

	public static void main(String[] args) {
		launch(args);
	}

	@Override
	public void start(Stage stage) throws IOException {

		this.Stage = stage;
		CreateScene();
		CreateSceneSignUp();
		GUESTGUI(guest, u, stage);

		try {

			loadMoviesData();
			loadShowsData();
			// main anchor pane that has everything literally everything
			AnchorPane root = new AnchorPane();

			// TOP ANCHOR PANE
			// this is my top anchor pane
			AnchorPane topFormAnchorPane = new AnchorPane();

			topFormAnchorPane.getStyleClass().add("top-form");

			topFormAnchorPane.setPrefHeight(47);
			topFormAnchorPane.setPrefWidth(1360);
			topFormAnchorPane.getStyleClass().add("top-form");
			topFormAnchorPane.getStylesheets().add(getClass().getResource("Admin_Dashboard.css").toExternalForm());

			ImageView exitIcon = new ImageView(new Image("Exit Icon.png"));
			exitIcon.setFitHeight(19);
			exitIcon.setFitWidth(51);
			exitIcon.setLayoutX(1312);
			exitIcon.setLayoutY(5);
			exitIcon.setMouseTransparent(true);
			exitIcon.setPickOnBounds(true);
			exitIcon.setPreserveRatio(true);

			ImageView minimizeIcon = new ImageView(new Image("Minimize Icon.png"));
			minimizeIcon.setFitHeight(19);
			minimizeIcon.setFitWidth(51);
			minimizeIcon.setLayoutX(1235);
			minimizeIcon.setLayoutY(5);
			minimizeIcon.setMouseTransparent(true);
			minimizeIcon.setPickOnBounds(true);
			minimizeIcon.setPreserveRatio(true);

			Label titleLabel = new Label("Movie Booking Ticket System Management");
			titleLabel.setLayoutX(57);
			titleLabel.setLayoutY(13);
			titleLabel.setPrefHeight(21);
			titleLabel.setPrefWidth(294);
			titleLabel.setFont(new Font("Microsoft Sans Serif", 14));

			ImageView glassesIcon = new ImageView(new Image("Movie Glasses Icon.png"));
			glassesIcon.setFitHeight(29);
			glassesIcon.setFitWidth(33);
			glassesIcon.setLayoutX(19);
			glassesIcon.setLayoutY(9);
			glassesIcon.setPickOnBounds(true);
			glassesIcon.setPreserveRatio(true);

			topFormAnchorPane.getChildren().addAll(exitButton, minimizeButton, exitIcon, minimizeIcon, titleLabel,
					glassesIcon);

			// ADMIN ANCHOR PANE
			// this is my admin anchor pane on the left side

			AnchorPane adminFormPane = new AnchorPane();

			adminFormPane.setLayoutY(57);
			adminFormPane.setPrefHeight(853);
			adminFormPane.setPrefWidth(255);
			adminFormPane.getStyleClass().add("nav-form");
			adminFormPane.getStylesheets().add(getClass().getResource("Admin_Dashboard.css").toExternalForm());

			ImageView userIcon = new ImageView(new Image("User Icon.png"));
			userIcon.setFitHeight(185);
			userIcon.setFitWidth(177);
			userIcon.setLayoutX(38);
			userIcon.setLayoutY(14);
			userIcon.setPickOnBounds(true);
			userIcon.setPreserveRatio(true);

			ImageView groupOfUsersIcon = new ImageView(new Image("Group Of Users Icon.png"));
			groupOfUsersIcon.setFitHeight(96);
			groupOfUsersIcon.setFitWidth(39);
			groupOfUsersIcon.setLayoutX(20);
			groupOfUsersIcon.setLayoutY(394);
			groupOfUsersIcon.setMouseTransparent(true);
			groupOfUsersIcon.setPickOnBounds(true);
			groupOfUsersIcon.setPreserveRatio(true);

			ImageView moviesIcon = new ImageView(new Image("Movies Icon.jpg"));
			moviesIcon.setFitHeight(39);
			moviesIcon.setFitWidth(39);
			moviesIcon.setLayoutX(19);
			moviesIcon.setLayoutY(300);
			moviesIcon.setMouseTransparent(true);
			moviesIcon.setPickOnBounds(true);
			moviesIcon.setPreserveRatio(true);

			ImageView showsIcon = new ImageView(new Image("Shows Icon.jpg"));
			showsIcon.setFitHeight(39);
			showsIcon.setFitWidth(45);
			showsIcon.setLayoutX(19);
			showsIcon.setLayoutY(347);
			showsIcon.setMouseTransparent(true);
			showsIcon.setPickOnBounds(true);
			showsIcon.setPreserveRatio(true);

			ImageView signOutIcon = new ImageView(new Image("Sign Out Icon.png"));
			signOutIcon.setFitHeight(39);
			signOutIcon.setFitWidth(33);
			signOutIcon.setLayoutX(26);
			signOutIcon.setLayoutY(799);
			signOutIcon.setMouseTransparent(true);
			signOutIcon.setPickOnBounds(true);
			signOutIcon.setPreserveRatio(true);

			Label welcomeLabel = new Label("Welcome");
			welcomeLabel.setAlignment(javafx.geometry.Pos.CENTER);
			welcomeLabel.setLayoutX(48);
			welcomeLabel.setLayoutY(195);
			welcomeLabel.setPrefHeight(43);
			welcomeLabel.setPrefWidth(164);
			welcomeLabel.setFont(new Font(29));

			Label adminNameLabel = new Label("Admin_Name");
			adminNameLabel.setAlignment(javafx.geometry.Pos.CENTER);
			adminNameLabel.setLayoutX(48);
			adminNameLabel.setLayoutY(238);
			adminNameLabel.setPrefHeight(33);
			adminNameLabel.setPrefWidth(164);
			adminNameLabel.setFont(new Font(16));

			adminFormPane.getChildren().addAll(userIcon, userBtn, groupOfUsersIcon, moviesBtn, showsBtn, signOutBtn,
					moviesIcon, showsIcon, signOutIcon, welcomeLabel, adminNameLabel, signOutTextLabel, viewReveBtn,
					viewBookBtn);

			AnchorPane MoviesLeftAnchorPane = new AnchorPane();
			MoviesLeftAnchorPane.setLayoutX(14);
			MoviesLeftAnchorPane.setLayoutY(13);
			MoviesLeftAnchorPane.setPrefHeight(827);
			MoviesLeftAnchorPane.setPrefWidth(277);
			MoviesLeftAnchorPane.getStyleClass().add("bg-white");
			MoviesLeftAnchorPane.getStylesheets().add(getClass().getResource("Admin_Dashboard.css").toExternalForm());
			AnchorPane.setLeftAnchor(MoviesLeftAnchorPane, 14.0);

			// Movies Right Anchor Pane
			// ////////////////////////////////////////////////////////////////
			AnchorPane MoviesRightAnchorPane = new AnchorPane();
			MoviesRightAnchorPane.setLayoutX(MoviesLeftAnchorPane.getPrefWidth() + 30);
			MoviesRightAnchorPane.setLayoutY(13);
			MoviesRightAnchorPane.setPrefHeight(MoviesLeftAnchorPane.getPrefHeight());
			MoviesRightAnchorPane.setPrefWidth(788);
			MoviesRightAnchorPane.getStyleClass().add("bg-white");
			MoviesRightAnchorPane.getStylesheets().add(getClass().getResource("Admin_Dashboard.css").toExternalForm());
			////////////////////////////////////////////////////////////////////////////////////////////

			ImageView moviesIcon1 = new ImageView(new Image("Movies Icon.jpg"));
			moviesIcon1.setFitHeight(245);
			moviesIcon1.setFitWidth(245);
			moviesIcon1.setLayoutX(16);
			moviesIcon1.setLayoutY(14);
			moviesIcon1.setMouseTransparent(true);
			moviesIcon1.setPickOnBounds(true);
			moviesIcon1.setPreserveRatio(true);

			// Date Picker
			publishedDatePicker.setLayoutX(111.0);
			publishedDatePicker.setLayoutY(580.0);
			publishedDatePicker.setPrefHeight(20.0);
			publishedDatePicker.setPrefWidth(155.0);
			publishedDatePicker.setPromptText("yyyy-MM-dd");
			publishedDatePicker.setEditable(false);
			publishedDatePicker.getStyleClass().add("combo-box");
			publishedDatePicker.getStylesheets().add(getClass().getResource("Admin_Dashboard.css").toExternalForm());

			// TableView
			tableView.setLayoutX(15.0);
			tableView.setLayoutY(60.0);
			tableView.setPrefHeight(748.0);
			tableView.setPrefWidth(759.0);

			idColumn.setPrefWidth(53.0);
			movieNameColumn.setMinWidth(0.0);
			movieNameColumn.setPrefWidth(163.0);
			moviePriceColumn.setPrefWidth(85.0);
			directorColumn.setPrefWidth(110.0);
			genreColumn.setPrefWidth(110.0);
			durationColumn.setPrefWidth(105.0);
			publishedDateColumn.setPrefWidth(134.0);

			idColumn.setCellValueFactory(data -> data.getValue().idProperty().asObject());
			movieNameColumn.setCellValueFactory(data -> data.getValue().movieNameProperty());
			moviePriceColumn.setCellValueFactory(data -> data.getValue().moviePriceProperty().asObject());
			directorColumn.setCellValueFactory(data -> data.getValue().movieDirectorProperty());
			genreColumn.setCellValueFactory(data -> data.getValue().movieGenreProperty());
			durationColumn.setCellValueFactory(data -> data.getValue().movieDurationProperty());
			publishedDateColumn.setCellValueFactory(data -> data.getValue().moviePublishedDateProperty());

			tableView.getColumns().addAll(idColumn, movieNameColumn, moviePriceColumn, directorColumn, genreColumn,
					durationColumn, publishedDateColumn);

			tableView.getSelectionModel().selectedItemProperty().addListener((obs, oldSelection, newSelection) -> {

				if (newSelection != null) {
					movieNameTextField.setText(newSelection.getMovieName());
					moviePriceTextField.setText(String.valueOf(newSelection.getMovieTicketPrice()));
					directorTextField.setText(newSelection.getMovieDirector());
					genreTextField.setText(newSelection.getMovieGenre());
					String movieDurationString = newSelection.getMovieDuration();
					String[] movieDurationStringParts = movieDurationString.split(":");
					if (movieDurationStringParts.length == 2) {

						int hours = Integer.parseInt(movieDurationStringParts[0].trim());
						int minutes = Integer.parseInt(movieDurationStringParts[1].split(" ")[0].trim());

						durationHourTextField.setText(String.valueOf(hours));
						durationMinTextField.setText(String.valueOf(minutes));
					}
					publishedDatePicker.setValue(LocalDate.parse(newSelection.getPublishedMovieDate().toString()));
				}
			});

			ImageView searchIconImageView = new ImageView(new Image("Search Icon.png"));
			searchIconImageView.setFitHeight(25.0);
			searchIconImageView.setFitWidth(21.0);
			searchIconImageView.setLayoutX(23.0);
			searchIconImageView.setLayoutY(20.0);
			searchIconImageView.setOpacity(0.27);

			AnchorPane ShowsAnchorPane = new AnchorPane();
			ShowsAnchorPane.setLayoutX(255);
			ShowsAnchorPane.setLayoutY(57);
			ShowsAnchorPane.setPrefHeight(861);
			ShowsAnchorPane.setPrefWidth(1080);
			ShowsAnchorPane.setVisible(false);

			AnchorPane ShowsLeftAnchorPane = new AnchorPane();
			ShowsLeftAnchorPane.setLayoutX(14);
			ShowsLeftAnchorPane.setLayoutY(13);
			ShowsLeftAnchorPane.setPrefHeight(827);
			ShowsLeftAnchorPane.setPrefWidth(277);
			ShowsLeftAnchorPane.getStyleClass().add("bg-white");
			ShowsLeftAnchorPane.getStylesheets().add(getClass().getResource("Admin_Dashboard.css").toExternalForm());
			AnchorPane.setLeftAnchor(ShowsLeftAnchorPane, 14.0);

			AnchorPane ShowsRightAnchorPane = new AnchorPane();
			ShowsRightAnchorPane.setLayoutX(MoviesLeftAnchorPane.getPrefWidth() + 30);
			ShowsRightAnchorPane.setLayoutY(13);
			ShowsRightAnchorPane.setPrefHeight(MoviesLeftAnchorPane.getPrefHeight());
			ShowsRightAnchorPane.setPrefWidth(788);
			ShowsRightAnchorPane.getStyleClass().add("bg-white");
			ShowsRightAnchorPane.getStylesheets().add(getClass().getResource("Admin_Dashboard.css").toExternalForm());

			ImageView showsIcon1 = new ImageView(new Image("Shows Icon.jpg"));
			showsIcon1.setFitHeight(294);
			showsIcon1.setFitWidth(266);
			showsIcon1.setLayoutX(6);
			showsIcon1.setLayoutY(14);
			showsIcon1.setMouseTransparent(true);
			showsIcon1.setPickOnBounds(true);
			showsIcon1.setPreserveRatio(true);

			AnchorPane ViewRevenue = new AnchorPane();
			ViewRevenue.setLayoutX(255);
			ViewRevenue.setLayoutY(57);
			ViewRevenue.setPrefHeight(861);
			ViewRevenue.setPrefWidth(1080);
			ViewRevenue.setVisible(false);

			Button b1 = new Button();

			ChoiceBox<String> cb = new ChoiceBox<>();
			Label l1 = new Label("Review The most Proftable Receptionist and the most spending guest");
			Label l2 = new Label();
			// Label info = new Label();
			Text t = new Text();

//			info.setLayoutX(120);
//			info.setLayoutY(260);
//			info.setTextFill(Color.BLACK);
//			info.setFont(Font.font("Verdana",15));
//			

			t.setLayoutX(140);
			t.setLayoutY(260);
			t.setFill(Color.BLACK);
			t.setFont(Font.font("Verdana", 15));

			l1.setLayoutX(100);
			l1.setLayoutY(50);
			l1.setTextFill(Color.BLACK);
			l1.setFont(Font.font("Verdana", 19));

			l2.setText("Choose the type of user to view :");
			l2.setLayoutX(80);
			l2.setLayoutY(200);
			l2.setTextFill(Color.BLACK);
			l2.setFont(Font.font("Verdana", 12));
			// Stage.setScene(scene);

			b1.setText("Display");
			b1.setLayoutX(480);
			b1.setLayoutY(200);
			b1.setPrefHeight(10);
			b1.setPrefWidth(100);
			b1.setOnAction(event -> {
				try {
					getChoiceRevenue(cb, t);
				} catch (FileNotFoundException e) {
					e.printStackTrace();
				} catch (IOException e) {
					e.printStackTrace();
				}
			});

			cb.getItems().addAll("Most Revenue Receptionist", "Most spending Guest");
			cb.setValue("Choose an option ");
			cb.setLayoutX(300);
			cb.setLayoutY(200);

			ViewRevenue.getChildren().addAll(cb, b1, l1, l2, t);

			AnchorPane viewBooking = new AnchorPane();
			viewBooking.setLayoutX(255);
			viewBooking.setLayoutY(57);
			viewBooking.setPrefHeight(861);
			viewBooking.setPrefWidth(1080);
			viewBooking.setVisible(false);

			ChoiceBox<String> cb1 = new ChoiceBox<>();
			cb1.getItems().addAll("Most Booked Receptionist", "Most Booked Guest");
			cb1.setValue("Choose an option ");
			cb1.setLayoutX(270);
			cb1.setLayoutY(200);

			Label bookHead = new Label("Review The most Booking Receptionist and the most Booking guest");
			Label choiceLabel = new Label();
			Button dsiplayButton = new Button();
			Text tt = new Text();

			tt.setLayoutX(140);
			tt.setLayoutY(260);
			tt.setFill(Color.BLACK);
			tt.setFont(Font.font("Verdana", 15));

			bookHead.setLayoutX(100);
			bookHead.setLayoutY(50);
			bookHead.setTextFill(Color.BLACK);
			bookHead.setFont(Font.font("Verdana", 19));

			choiceLabel.setText("Choose the type of user to view :");
			choiceLabel.setLayoutX(50);
			choiceLabel.setLayoutY(200);
			choiceLabel.setTextFill(Color.BLACK);
			choiceLabel.setFont(Font.font("Verdana", 12));

			dsiplayButton.setText("Display");
			dsiplayButton.setLayoutX(450);
			dsiplayButton.setLayoutY(200);
			dsiplayButton.setPrefHeight(10);
			dsiplayButton.setPrefWidth(100);
			dsiplayButton.setOnAction(event -> {

				try {
					getChoiceBooking(cb1, tt);
				} catch (FileNotFoundException e) {
					// TODO Auto-generated catch block
					e.printStackTrace();
				} catch (IOException e) {
					// TODO Auto-generated catch block
					e.printStackTrace();
				}
			});

			viewBooking.getChildren().addAll(dsiplayButton, choiceLabel, bookHead, tt, cb1);

			moviesTableView.setLayoutX(8.0);
			moviesTableView.setLayoutY(420.0);
			moviesTableView.setPrefHeight(315.0);
			moviesTableView.setPrefWidth(744.0);

			TableColumn<Movies, Long> idColumn1 = new TableColumn<>("ID");
			idColumn1.setPrefWidth(53.0);
			TableColumn<Movies, String> movieNameColumn1 = new TableColumn<>("Movie Name");
			movieNameColumn1.setMinWidth(0.0);
			movieNameColumn1.setPrefWidth(163.0);
			TableColumn<Movies, Integer> moviePriceColumn1 = new TableColumn<>("Price");
			moviePriceColumn1.setPrefWidth(85.0);
			TableColumn<Movies, String> directorColumn1 = new TableColumn<>("Director");
			directorColumn1.setPrefWidth(110.0);
			TableColumn<Movies, String> genreColumn1 = new TableColumn<>("Genre");
			genreColumn1.setPrefWidth(110.0);
			TableColumn<Movies, String> durationColumn1 = new TableColumn<>("Duration");
			durationColumn1.setPrefWidth(105.0);
			TableColumn<Movies, Date> publishedDateColumn1 = new TableColumn<>("Published Date");
			publishedDateColumn1.setPrefWidth(114.0);

			idColumn1.setCellValueFactory(data -> data.getValue().idProperty().asObject());
			movieNameColumn1.setCellValueFactory(data -> data.getValue().movieNameProperty());
			moviePriceColumn1.setCellValueFactory(data -> data.getValue().moviePriceProperty().asObject());
			directorColumn1.setCellValueFactory(data -> data.getValue().movieDirectorProperty());
			genreColumn1.setCellValueFactory(data -> data.getValue().movieGenreProperty());
			durationColumn1.setCellValueFactory(data -> data.getValue().movieDurationProperty());
			publishedDateColumn1.setCellValueFactory(data -> data.getValue().moviePublishedDateProperty());

			moviesTableView.getColumns().addAll(idColumn1, movieNameColumn1, moviePriceColumn1, directorColumn1,
					genreColumn1, durationColumn1, publishedDateColumn1);

			moviesTableView.getSelectionModel().selectedItemProperty()
					.addListener((obs, oldSelection, newSelection) -> {
						moviesTableView.setMouseTransparent(true);
					});

			showsTableView.setLayoutX(8.0);
			showsTableView.setLayoutY(60.0);
			showsTableView.setPrefHeight(341.0);
			showsTableView.setPrefWidth(744.0);

			TableColumn<Shows, Long> showIdColumn = new TableColumn<>("ID");
			showIdColumn.setPrefWidth(53.0);
			TableColumn<Shows, String> showTitleColumn = new TableColumn<>("Show Title");
			showTitleColumn.setMinWidth(0.0);
			showTitleColumn.setPrefWidth(195.0);
			TableColumn<Shows, Integer> showTicketPriceColumn = new TableColumn<>("Ticket Price");
			showTicketPriceColumn.setPrefWidth(110.0);
			TableColumn<Shows, String> showGenreColumn = new TableColumn<>("Genre");
			showGenreColumn.setPrefWidth(181.0);
			TableColumn<Shows, String> show_DateAndTimeColumn = new TableColumn<>("Show Date & Time");
			show_DateAndTimeColumn.setPrefWidth(200.0);

			showIdColumn.setCellValueFactory(data -> data.getValue().idProperty().asObject());
			showTitleColumn.setCellValueFactory(data -> data.getValue().showTitleProperty());
			showTicketPriceColumn.setCellValueFactory(data -> data.getValue().showTicketPriceProperty().asObject());
			showGenreColumn.setCellValueFactory(data -> data.getValue().showGenreProperty());
			show_DateAndTimeColumn.setCellValueFactory(data -> data.getValue().show_DateAndTimeProperty());

			showsTableView.getSelectionModel().selectedItemProperty().addListener((obs, oldSelection, newSelection) -> {

				if (newSelection != null) {
					moviePickedTextField.setText(newSelection.getShowTitle());
					showTicketPriceTextField.setText(String.valueOf(newSelection.getShowTicketPrice()));
					showGenreTextField.setText(newSelection.getShowGenre());
					String[] showDateTimeString = newSelection.getShowDateAndTime().split(" ");
					String[] showDateString = showDateTimeString[0].split("/");
					String[] showTimeString = showDateTimeString[1].split(":");

					showTimeHourTextField.setText(showTimeString[0]);
					showTimeMinTextField.setText(showTimeString[1]);
					showMonthTextField.setText(showDateString[0]);
					showDayTextField.setText(showDateString[1]);
				}
			});

			showsTableView.getColumns().addAll(showIdColumn, showTitleColumn, showTicketPriceColumn, showGenreColumn,
					show_DateAndTimeColumn);

			AnchorPane UsersAnchorPane = new AnchorPane();
			UsersAnchorPane.setLayoutX(255);
			UsersAnchorPane.setLayoutY(57);
			UsersAnchorPane.setPrefHeight(861);
			UsersAnchorPane.setPrefWidth(1080);
			UsersAnchorPane.setVisible(false);

			btt.setPrefHeight(40);
			btt.setPrefWidth(100);
			btt.setLayoutX(50);
			btt.setLayoutY(140);
			btt.getStyleClass().add("insert-btn");
			btt.getStylesheets().add(getClass().getResource("Admin_Dashboard.css").toExternalForm());
			btt2.setPrefHeight(40);
			btt2.setPrefWidth(100);
			btt2.setLayoutX(50);
			btt2.setLayoutY(240);
			btt2.getStyleClass().add("delete-btn");
			btt2.getStylesheets().add(getClass().getResource("Admin_Dashboard.css").toExternalForm());
			btt3.setPrefHeight(40);
			btt3.setPrefWidth(100);
			btt3.setLayoutX(50);
			btt3.setLayoutY(340);
			btt3.getStyleClass().add("update-btn");
			btt3.getStylesheets().add(getClass().getResource("Admin_Dashboard.css").toExternalForm());
			btt4.setPrefHeight(40);
			btt4.setPrefWidth(100);
			btt4.setLayoutX(50);
			btt4.setLayoutY(440);
			btt4.getStyleClass().add("clear-btn");
			btt4.getStylesheets().add(getClass().getResource("Admin_Dashboard.css").toExternalForm());

			UsersAnchorPane.getChildren().addAll(btt, btt2, btt3, btt4);

			btt.setOnAction(event -> {

				try {
					sceneadd();
				} catch (IOException e) {

					e.printStackTrace();
				}
				stage.setScene(scene_search);
			});
			btt2.setOnAction(event -> {

				removescene();

				stage.setScene(remove_scene);
			});
			btt3.setOnAction(event -> {
				try {
					editscene();
				} catch (FileNotFoundException e) {

					e.printStackTrace();
				}
				stage.setScene(edit_scene);
			});

			btt4.setOnAction(event -> {
				search();

				stage.setScene(search_scene);
			});

			MoviesLeftAnchorPane.getChildren().addAll(movieNameLabel, durationHourLabel, durationMinLabel, genreLabel,
					directorLabel, movieNameTextField, durationHourTextField, durationMinTextField, genreTextField,
					publishedDatePicker, publishedDateLabel, directorTextField, insertButton, updateButton, clearButton,
					deleteButton, moviePriceLabel, moviePriceTextField, moviesIcon1);
			MoviesRightAnchorPane.getChildren().addAll(tableView, searchTextField, searchIconImageView);

			ShowsLeftAnchorPane.getChildren().addAll(moviePickedLabel, showDayLabel, showMonthLabel, showTimeMinLabel,
					showTimeMinTextField, showTimeHourTextField, showTimeHourLabel, insertButton1, updateButton1,
					clearButton1, deleteButton1, moviePickedTextField, showsIcon1, showTicketPriceLabel, showGenreLabel,
					showTicketPriceTextField, showGenreTextField, showDayTextField, showMonthTextField);
			ShowsRightAnchorPane.getChildren().addAll(showsTableView, showSearchTextField, showSearchIconImageView,
					selectMovieButton, clearMovieButton, moviesTableView, movieSearchTextField,
					movieSearchIconImageView);

			MoviesAnchorPane.getChildren().addAll(MoviesLeftAnchorPane, MoviesRightAnchorPane);
			ShowsAnchorPane.getChildren().addAll(ShowsLeftAnchorPane, ShowsRightAnchorPane);

			root.getChildren().addAll(topFormAnchorPane, adminFormPane, MoviesAnchorPane, ShowsAnchorPane,
					UsersAnchorPane, ViewRevenue, viewBooking);

			moviesBtn.setOnAction(event -> {
				MoviesAnchorPane.setVisible(true);
				ShowsAnchorPane.setVisible(false);
				UsersAnchorPane.setVisible(false);
				ViewRevenue.setVisible(false);
				viewBooking.setVisible(false);
			});

			viewReveBtn.setOnAction(event -> {
				MoviesAnchorPane.setVisible(false);
				ShowsAnchorPane.setVisible(false);
				UsersAnchorPane.setVisible(false);
				ViewRevenue.setVisible(true);
				viewBooking.setVisible(false);

			});
			viewBookBtn.setOnAction(event -> {
				MoviesAnchorPane.setVisible(false);
				ShowsAnchorPane.setVisible(false);
				UsersAnchorPane.setVisible(false);
				ViewRevenue.setVisible(false);
				viewBooking.setVisible(true);
			});

			showsBtn.setOnAction(event -> {
				MoviesAnchorPane.setVisible(false);
				ShowsAnchorPane.setVisible(true);
				UsersAnchorPane.setVisible(false);
				ViewRevenue.setVisible(false);
				viewBooking.setVisible(false);
			});

			userBtn.setOnAction(event -> {
				MoviesAnchorPane.setVisible(false);
				ShowsAnchorPane.setVisible(false);
				UsersAnchorPane.setVisible(true);
				ViewRevenue.setVisible(false);
				viewBooking.setVisible(false);
			});

			exitButton.setOnAction(event -> {
				saveMoviesData();
				saveShowsData();
				System.exit(0);
			});

			minimizeButton.setOnAction(event -> stage.setIconified(true));

			// BUTTON ACTION EVENTS CONFIGURATION MOVIES

			insertButton.setOnAction(e -> {
				if (checkMovieDataValidationInput()) {
					insertDataMovies();
				}
			});
			deleteButton.setOnAction(e -> deleteDataMovies());
			clearButton.setOnAction(e -> clearTextFieldsMovies());

			updateButton.setOnAction(e -> {
				if (checkMovieDataValidationInput()) {
					updateDataMovies();
				}
			});

			searchTextField.textProperty().addListener((observable, oldValue, newValue) -> {
				filterMovies(newValue);
			});

			// BUTTON ACTION EVENTS CONFIGURATION SHOWS
			selectMovieButton.setOnAction(e -> movieRowSelected());
			clearMovieButton.setOnAction(e -> {
				moviesTableView.getSelectionModel().clearSelection();
				moviesTableView.setMouseTransparent(false);
			});

			insertButton1.setOnAction(e -> {
				if (checkShowDataValidationInput()) {
					insertDataShows();
				}
			});

			deleteButton1.setOnAction(e -> deleteDataShows());
			clearButton1.setOnAction(e -> clearTextFieldsShows());

			updateButton1.setOnAction(e -> {
				if (checkShowDataValidationInput()) {
					updateDataShows();
				}
			});

			movieSearchTextField.textProperty().addListener((observable, oldValue, newValue) -> {
				filterMovies1(newValue);
			});
			showSearchTextField.textProperty().addListener((observable, oldValue, newValue) -> {
				filterShows(newValue);
			});

			root.setOnMousePressed(event -> {
				x = event.getSceneX();
				y = event.getSceneY();
			});

			root.setOnMouseDragged(event -> {
				stage.setX(event.getScreenX() - x);
				stage.setY(event.getScreenY() - y);
			});

			sceneAdmin = new Scene(root, 1360, 908);

			sceneAdmin.getStylesheets().add(getClass().getResource("Admin_Dashboard.css").toExternalForm());

			stage.initStyle(StageStyle.TRANSPARENT);
			stage.setScene(scene1);
			stage.show();

		} catch (Exception e) {
			e.printStackTrace();
		}
		//mazen gui
		
		  // Create TableView columns
        TableColumn<ShowsControler, String> nameColumn = new TableColumn<>("Movie name");
        nameColumn.setMinWidth(200);
        nameColumn.setCellValueFactory(new PropertyValueFactory<>("movieName"));

        TableColumn<ShowsControler, String> showColumn = new TableColumn<>("Show");
        showColumn.setMinWidth(200);
        showColumn.setCellValueFactory(new PropertyValueFactory<>("show"));

        TableColumn<ShowsControler, String> timeColumn = new TableColumn<>("Showtime");
        timeColumn.setMinWidth(200);
        timeColumn.setCellValueFactory(new PropertyValueFactory<>("showtime"));

        TableColumn<ShowsControler, Integer> priceColumn = new TableColumn<>("Price");
        priceColumn.setMinWidth(200);
        priceColumn.setCellValueFactory(new PropertyValueFactory<>("price"));

        gc = new TableView<>();
        gc.setItems(getShows());
        gc.getColumns().addAll(nameColumn, showColumn, timeColumn, priceColumn);

        // Create ComboBoxes for choosing hall and seat
        hallComboBox = new ComboBox<>();
        for (int i = 1; i <= 7; i++) {
            hallComboBox.getItems().add("Hall " + i);
        }
        hallComboBox.setPromptText("Choose Hall");

        seatComboBox = new ComboBox<>();
        for (int i = 1; i <= 100; i++) {
            seatComboBox.getItems().add("Seat " + i);
        }
        seatComboBox.setPromptText("Choose Seat");

        // Create buttons
        Button createBookingButton = new Button("Create Booking");
        createBookingButton.setOnAction(e -> createBooking());

        Button exitButton = new Button("Exit");
        exitButton.setOnAction(e -> stage.close());

        // Create an HBox and add the TableView, ComboBoxes, and buttons to it
        HBox hbox = new HBox(10);
        hbox.getChildren().addAll(gc, hallComboBox, seatComboBox, createBookingButton, exitButton);

        Recepscene = new Scene(hbox, 800, 600);

        
       
		
		
		
	}

	// CREATION METHODS ////////////////////////////////////////////////

	private AnchorPane createAnchorPane(double layoutX, double layoutY, double prefHeight, double prefWidth,
			Boolean visibility) {

		AnchorPane anchorPane = new AnchorPane();
		anchorPane.setLayoutX(layoutX);
		anchorPane.setLayoutY(layoutY);
		anchorPane.prefHeight(prefHeight);
		anchorPane.prefWidth(prefWidth);
		anchorPane.setVisible(visibility);
		return anchorPane;
	}

	private Label createLabel(String text, double layoutX, double layoutY, double fontSize) {
		Label label = new Label(text);
		label.setLayoutX(layoutX);
		label.setLayoutY(layoutY);
		label.setFont(new javafx.scene.text.Font(fontSize));
		return label;
	}

	private Label createLabel(String text, double layoutX, double layoutY, double prefHeight, double prefWidth,
			double fontSize) {
		Label label = new Label(text);
		label.setLayoutX(layoutX);
		label.setLayoutY(layoutY);
		label.prefHeight(prefHeight);
		label.prefWidth(prefWidth);
		label.setFont(new javafx.scene.text.Font(fontSize));
		return label;
	}

	private TextField createTextField(double layoutX, double layoutY, double prefWidth, String styleClass) {
		TextField textField = new TextField();
		textField.setLayoutX(layoutX);
		textField.setLayoutY(layoutY);
		textField.setPrefWidth(prefWidth);
		textField.getStyleClass().add(styleClass);
		textField.getStylesheets().add(getClass().getResource("Admin_Dashboard.css").toExternalForm());
		return textField;
	}

	private TextField createTextField(double layoutX, double layoutY, double prefHeight, double prefWidth,
			String styleClass) {
		TextField textField = new TextField();
		textField.setLayoutX(layoutX);
		textField.setLayoutY(layoutY);
		textField.setPrefHeight(prefHeight);
		textField.setPrefWidth(prefWidth);
		textField.getStyleClass().add(styleClass);
		textField.getStylesheets().add(getClass().getResource("Admin_Dashboard.css").toExternalForm());
		return textField;
	}

	private TextField createTextField(double layoutX, double layoutY, double prefHeight, double prefWidth,
			String styleClass, Boolean isEditable) {
		TextField textField = new TextField();
		textField.setLayoutX(layoutX);
		textField.setLayoutY(layoutY);
		textField.setPrefHeight(prefHeight);
		textField.setPrefWidth(prefWidth);
		textField.getStyleClass().add(styleClass);
		textField.getStylesheets().add(getClass().getResource("Admin_Dashboard.css").toExternalForm());
		textField.setEditable(isEditable);
		return textField;
	}

	private Button createButton(String text, double layoutX, double layoutY, String styleClass) {
		Button button = new Button(text);
		button.setLayoutX(layoutX);
		button.setLayoutY(layoutY);
		button.setMnemonicParsing(false);
		button.setPrefHeight(57.0);
		button.setPrefWidth(108.0);
		button.getStyleClass().add(styleClass);
		button.getStylesheets().add(getClass().getResource("Admin_Dashboard.css").toExternalForm());
		return button;
	}

	private TextField createSearchTextField(double layoutX, double layoutY, String promptText) {
		TextField textField = new TextField();
		textField.setLayoutX(layoutX);
		textField.setLayoutY(layoutY);
		textField.setPrefHeight(25.0);
		textField.setPrefWidth(166.0);
		textField.setPromptText(promptText);
		textField.getStyleClass().add("search");
		textField.getStylesheets().add(getClass().getResource("Admin_Dashboard.css").toExternalForm());
		return textField;
	}

	private ImageView createSearchIconImageView(double layoutX, double layoutY) {
		ImageView searchIconImageView = new ImageView(new Image("Search Icon.png"));
		searchIconImageView.setFitHeight(25.0);
		searchIconImageView.setFitWidth(21.0);
		searchIconImageView.setLayoutX(layoutX);
		searchIconImageView.setLayoutY(layoutY);
		searchIconImageView.setOpacity(0.27);
		return searchIconImageView;
	}

	private Button createButton(String text, double layoutX, double layoutY, double prefWidth, String styleClass) {
		Button button = new Button(text);
		button.setLayoutX(layoutX);
		button.setLayoutY(layoutY);
		button.setMnemonicParsing(false);
		button.setPrefHeight(57.0);
		button.setPrefWidth(prefWidth);
		button.getStyleClass().add(styleClass);
		button.getStylesheets().add(getClass().getResource("Admin_Dashboard.css").toExternalForm());
		return button;
	}

	private Button createButton(String text, String text2, double layoutY, double prefHeight, double prefWidth,
			String styleClass) {
		Button button = new Button(text);
		button.setLayoutY(layoutY);
		button.setPrefHeight(prefHeight);
		button.setPrefWidth(prefWidth);
		button.getStyleClass().add(styleClass);
		button.getStylesheets().add(getClass().getResource("Admin_Dashboard.css").toExternalForm());
		return button;
	}

	private Button createButton(String text, double layoutX, double layoutY, double prefHeight, double prefWidth,
			String styleClass) {
		Button button = new Button(text);
		button.setLayoutX(layoutX);
		button.setLayoutY(layoutY);
		button.setMnemonicParsing(false);
		button.setPrefHeight(prefHeight);
		button.setPrefWidth(prefWidth);
		button.getStyleClass().add(styleClass);
		button.getStylesheets().add(getClass().getResource("Admin_Dashboard.css").toExternalForm());
		return button;
	}

	///////////////////////////////////////////////////////////////////////////////////////////////

	private void insertDataMovies() {

		movieID++;
		String movieName = movieNameTextField.getText().trim();
		String moviePriceText = moviePriceTextField.getText().trim();
		String movieDirector = directorTextField.getText().trim();
		String movieGenre = genreTextField.getText().trim();
		String movieDurationHourText = durationHourTextField.getText().trim();
		String movieDurationMinText = durationMinTextField.getText().trim();
		LocalDate moviePublishedLocalDate = publishedDatePicker.getValue();
		Date moviePublishedDate = java.sql.Date.valueOf(moviePublishedLocalDate);
		int moviePrice = Integer.parseInt(moviePriceText);
		int movieDurationHour = Integer.parseInt(movieDurationHourText);
		int movieDurationMin = Integer.parseInt(movieDurationMinText);

		Movies movie = new Movies(movieID, movieName, moviePrice, movieDirector, movieGenre, moviePublishedDate,
				movieDurationHour, movieDurationMin);

		Admin.addMovie(movie);
		// moviesList.add(movie);
		// moviesList1.add(movie);

		tableView.setItems(Admin.getMoviesList());
		moviesTableView.setItems(Admin.getMoviesList());

		clearTextFieldsMovies();
	}

	private void CreateScene() throws IOException {
		// Image image = new Image("Log in.jpg");
		// ImageView igv = new ImageView(new Image ("Log in.jpg"));
		// igv.setFitHeight(390);
		// igv.setFitWidth(310);
//				igv.prefHeight(390);
//				igv.prefWidth(310);
		// igv.setLayoutX(100);
		// igv.setLayoutY(30);

		Group root = new Group();
		scene1 = new Scene(root, 800, 550, Color.WHITE);

		// igv.setFitWidth(200);
		// igv.setPreserveRatio(true);

		Text t1 = new Text();
		t1.setText("Please enter your credentials");
		t1.setX(220);
		t1.setY(200);
		t1.setFont(Font.font("Verdana", 25));
		t1.setFill(Color.BLACK);

		Button b1 = new Button();
		// Font font = Font.font("Courier New", FontWeight.BOLD, 30);
		b1.setText("Log In");
		// b1.setMaxSize(100, 100);
		// b1.setFont(font);
		b1.setPrefHeight(40);
		b1.setPrefWidth(100);
		b1.setLayoutX(280);
		b1.setLayoutY(400);
		// b1.setOnAction(event -> primaryStage.setScene(scene2));

		// b1.setDefaultButton(true);
		Button b2 = new Button();
		b2.setText("Sign up");
		b2.setPrefHeight(40);
		b2.setPrefWidth(100);
		b2.setLayoutX(430);
		b2.setLayoutY(400);
		b2.setOnAction(event -> Stage.setScene(sceneSignUp));

		Label l1 = new Label("Enter Username:");
		Label l2 = new Label("Enter Password:");
		l1.setLayoutX(200);
		l1.setLayoutY(310);
		l1.setTextFill(Color.BLACK);
		l1.setFont(Font.font("Verdana", 13));

		l2.setLayoutX(200);
		l2.setLayoutY(350);
		l2.setTextFill(Color.BLACK);
		l2.setFont(Font.font("Verdana", 13));

		TextField tf1 = new TextField();
		// TextField tf2 = new TextField();
//				tf1.setLayoutX(30);
//				tf1.setLayoutY(350);
		tf1.setLayoutX(330);
		tf1.setLayoutY(310);

		// ToggleButton tg = new ToggleButton();

		PasswordField ps = new PasswordField();
		ps.setLayoutX(330);
		ps.setLayoutY(350);
		// String pass = ps.getText();
		// ps.visibleProperty().bind(tg.selectedProperty().not());
		ps.setSkin(new MySkin(ps));

		Label l3 = new Label();
		l3.setLayoutX(330);
		l3.setLayoutY(370);
		l3.setFont(Font.font("Verdana", FontWeight.BOLD, 14));
		l3.setTextFill(Color.BLACK);
		ps.onKeyPressedProperty().set(new EventHandler<KeyEvent>() {

			@Override
			public void handle(KeyEvent arg0) {
				String length = ps.getText();
				l3.setText(length);
			}

		});

		b1.setOnAction(event -> {

			try {
				// ArrayList<User> user = Admin.ReadUsers();
				u = User.SignIn(tf1.getText(), ps.getText());
				if (u == null) {

					Alert inc = new Alert(Alert.AlertType.INFORMATION);
					inc.setTitle("Incorrect information ");
					inc.setHeaderText("Incorrect Username or password ");
					inc.showAndWait();
				} else {

					if (u.getRole() == Role.Admin) {
						Stage.setScene(sceneAdmin);
					} else if (u.getRole() == Role.Guest) {
						Stage.setScene(sceneGuest);
						Main.GUESTGUI(sceneGuest, u, Stage);

					} else if (u.getRole() == Role.Receptionist) {
						Stage.setScene(Recepscene);
					}
				}
			} catch (IOException e) {
				e.printStackTrace();
			}

		});
		root.getChildren().addAll(tf1, t1, ps, b1, b2, l1, l2);
	}

	private void CreateSceneSignUp() {
		Group root = new Group();
		sceneSignUp = new Scene(root, 800, 550, Color.BLACK);
		Label l1 = new Label("Enter First Name: ");
		Label l5 = new Label("Enter Last Name: ");
		Label l2 = new Label("Enter Username: ");
		Label l3 = new Label("Enter Password: ");
		// Label l4 = new Label("Choose your Role: ");

		TextField tf1 = new TextField();
		TextField tf2 = new TextField();
		// TextField tf3 = new TextField();
		TextField tf4 = new TextField();
		PasswordField ps = new PasswordField();
		ps.setLayoutX(330);
		ps.setLayoutY(390);
		ps.setSkin(new MySkin(ps));

//				ToggleGroup tg = new ToggleGroup();
//				RadioButton r1 = new RadioButton("Guest");
//				RadioButton r2 = new RadioButton("Receptionist");

		Button b1 = new Button();

		b1.setText("Submit");
		b1.setPrefHeight(40);
		b1.setPrefWidth(100);
		b1.setLayoutX(350);
		b1.setLayoutY(480);
		// b1.setOnAction(event -> primaryStage.setScene(scene1));
		b1.setOnAction(event -> {

			String Role = "Guest";
			String First_Name = tf1.getText();
			String Last_name = tf4.getText();
			String UserName = tf2.getText();
			String password = ps.getText();

			if (First_Name.equals("") || Last_name.equals("") || UserName.equals("") || password.equals("")) {
				Alert ad = new Alert(Alert.AlertType.ERROR);
				ad.setTitle("Insufficient data");
				ad.setHeaderText("Insufficient information please make sure to enter all information correctly");
				ad.showAndWait();
			}

			try {
				if (Admin.checkUnique(UserName) == false) {
					Alert ad = new Alert(Alert.AlertType.INFORMATION);
					ad.setTitle("Username unavaliable ");
					ad.setHeaderText(" Username already exist please try a new username ");
					ad.showAndWait();
				} else {
					Guest l = new Guest(First_Name, Last_name, 0, 0);
					int id = l.get_id();
					l.set_id(id);
					l.setUserName(UserName);
					l.setPassword(password);
					l.setRole(Role);
					Admin.adding_user_to_the_file(l);
				}
			} catch (FileNotFoundException e) {
				e.printStackTrace();
			} catch (IOException e) {
				e.printStackTrace();
			}

//					User u = new User(First_Name, Last_name, Role);
//					int id = u.get_id();
//					u.set_id(id);
//					u.setUserName(UserName);
//					u.setPassword(password);

			Stage.setScene(scene1);
		});
		//
//				r1.setLayoutX(320);
//				r1.setLayoutY(430);
//				r1.setTextFill(Color.WHITE);
//				r1.setToggleGroup(tg);
		//
//				r2.setLayoutX(390);
//				r2.setLayoutY(430);
//				r2.setTextFill(Color.WHITE);
//				r2.setToggleGroup(tg);

		tf1.setLayoutX(330);
		tf1.setLayoutY(270);

		tf2.setLayoutX(330);
		tf2.setLayoutY(350);

//				tf3.setLayoutX(330);
//				tf3.setLayoutY(390);

		tf4.setLayoutX(330);
		tf4.setLayoutY(310);

		l1.setLayoutX(200);
		l1.setLayoutY(270);
		l1.setTextFill(Color.WHITE);
		l1.setFont(Font.font("Verdana", 13));

		l2.setLayoutX(200);
		l2.setLayoutY(350);
		l2.setTextFill(Color.WHITE);
		l2.setFont(Font.font("Verdana", 13));

		l3.setLayoutX(200);
		l3.setLayoutY(390);
		l3.setTextFill(Color.WHITE);
		l3.setFont(Font.font("Verdana", 13));

//				l4.setLayoutX(200);
//				l4.setLayoutY(430);
//				l4.setTextFill(Color.WHITE);
//				l4.setFont(Font.font("Verdana", 13));

		l5.setLayoutX(200);
		l5.setLayoutY(310);
		l5.setTextFill(Color.WHITE);
		l5.setFont(Font.font("Verdana", 13));

		root.getChildren().addAll(l1, l2, l3, l5, tf1, tf2, ps, tf4, b1);
	}

	private void getChoiceBooking(ChoiceBox<String> cb, Text t) throws FileNotFoundException, IOException {
		String choice = cb.getValue();
		Admin x = (Admin) u;
		HashMap<Integer, Receptionist> recep = new HashMap<>();
		HashMap<Integer, Guest> guest = new HashMap<>();
		ArrayList<User> user = Admin.ReadUsers();

		for (User u : user) {
			if (u.getRole() == Role.Receptionist) {
				if (u instanceof Receptionist) {
					recep.put(u.get_id(), (Receptionist) u);
				}
			}

			else if (u.getRole() == Role.Guest) {
				if (u instanceof Guest) {
					guest.put(u.get_id(), (Guest) u);
				}
			}
		}

		if (choice.equals("Most Booked Receptionist")) {

			if (recep.isEmpty()) {
				Alert ad = new Alert(Alert.AlertType.ERROR);
				ad.setTitle("Invalid user ");
				ad.setHeaderText(" No avaliable receptionist ");
				ad.showAndWait();
			} else {
				Receptionist k = x.max_ReceptionistBookings(recep);
				String re = k.toString();
				t.setText(re);
			}
		}
		if (choice.equals("Most Booked Guest")) {
			if (guest.isEmpty()) {
				Alert ad = new Alert(Alert.AlertType.ERROR);
				ad.setTitle("Invalid user ");
				ad.setHeaderText(" No avaliable guests ");
				ad.showAndWait();
			} else {
				Guest d = x.max_GuestBooking(guest);
				String guesst = d.toString();
				t.setText(guesst);
			}
		}

	}

	private void getChoiceRevenue(ChoiceBox<String> cb, Text t) throws FileNotFoundException, IOException {
		String choice = cb.getValue();
		Admin x = (Admin) u;
		HashMap<Integer, Receptionist> recep = new HashMap<>();
		HashMap<Integer, Guest> guest = new HashMap<>();
		ArrayList<User> user = Admin.ReadUsers();

		for (User u : user) {
			if (u.getRole() == Role.Receptionist) {
				if (u instanceof Receptionist) {
					recep.put(u.get_id(), (Receptionist) u);
				}
			} else if (u.getRole() == Role.Guest) {
				if (u instanceof Guest) {
					guest.put(u.get_id(), (Guest) u);
				}
			}
		}
		if (choice.equals("Most Revenue Receptionist")) {
			if (recep.isEmpty()) {
				Alert ad = new Alert(Alert.AlertType.ERROR);
				ad.setTitle("Invalid user ");
				ad.setHeaderText(" no avaliable receptionist ");
				ad.showAndWait();
			} else {
				Receptionist h = x.max_ReceptionistRevenue(recep);
				String l = h.toString();
				t.setText(l);
			}
		}
		if (choice.equals("Most spending Guest")) {
			if (guest.isEmpty()) {
				Alert ad = new Alert(Alert.AlertType.ERROR);
				ad.setTitle("Invalid user ");
				ad.setHeaderText(" no avaliable guests ");
				ad.showAndWait();
			} else {
				Guest rt = x.max_GuestRevenues(guest);
				String jk = rt.toString();
				t.setText(jk);
			}
		}
	}

	private void deleteDataMovies() {
		Movies selectedMovie = tableView.getSelectionModel().getSelectedItem();

		if (selectedMovie != null) {
			Admin.removeMovie(selectedMovie);
			clearTextFieldsMovies();
		}
	}

	private void clearTextFieldsMovies() {
		movieNameTextField.clear();
		moviePriceTextField.clear();
		directorTextField.clear();
		genreTextField.clear();
		durationHourTextField.clear();
		durationMinTextField.clear();
		publishedDatePicker.setValue(null);
		tableView.getSelectionModel().clearSelection();
	}

	private void updateDataMovies() {

		int selectedMovieRowIndex = tableView.getSelectionModel().getSelectedIndex();

		if (selectedMovieRowIndex >= 0) {

			Movies selectedMovie = tableView.getItems().get(selectedMovieRowIndex);

			String updatedMovieName = movieNameTextField.getText();
			int updatedMoviePrice = Integer.parseInt(moviePriceTextField.getText());
			String updatedMovieDirector = directorTextField.getText();
			String updatedMovieGenre = genreTextField.getText();
			Date updatedPublishedMovieDate = java.sql.Date.valueOf(publishedDatePicker.getValue());
			int updatedMovieHours = Integer.parseInt(durationHourTextField.getText());
			int updatedMovieMin = Integer.parseInt(durationMinTextField.getText());

			selectedMovie.setMovieName(updatedMovieName);
			selectedMovie.setMovieTicketPrice(updatedMoviePrice);
			selectedMovie.setMovieDirector(updatedMovieDirector);
			selectedMovie.setMovieGenre(updatedMovieGenre);
			selectedMovie.setMovieDuration(updatedMovieHours, updatedMovieMin);
			selectedMovie.setPublishedMovieDate(updatedPublishedMovieDate);

			Admin.editMovie(selectedMovieRowIndex, selectedMovie);
			tableView.getItems().set(selectedMovieRowIndex, selectedMovie);
			moviesTableView.getItems().set(selectedMovieRowIndex, selectedMovie);

			clearTextFieldsMovies();
		}
	}

	private void filterMovies(String search) {
		if (search == null || search.trim().isEmpty()) {
			tableView.setItems(Admin.getMoviesList());
		} else {
			ObservableList<Movies> filteredListMovies = Admin.getMoviesList().filtered(movie ->

			String.valueOf(movie.getMovie_ID()).toLowerCase().contains(search.toLowerCase())
					|| movie.getMovieName().toLowerCase().contains(search.toLowerCase())
					|| String.valueOf(movie.getMovieTicketPrice()).toLowerCase().contains(search.toLowerCase())
					|| movie.getMovieDirector().toLowerCase().contains(search.toLowerCase())
					|| movie.getMovieGenre().toLowerCase().contains(search.toLowerCase())
					|| movie.getMovieDuration().toLowerCase().contains(search.toLowerCase())
					|| String.valueOf(movie.getMovieID()).toLowerCase().contains(search.toLowerCase())
					|| String.valueOf(movie.getPublishedMovieDate()).toLowerCase().contains(search.toLowerCase()));
			tableView.setItems(filteredListMovies);
		}
	}

	private void movieRowSelected() {
		Movies selectedMovie = moviesTableView.getSelectionModel().getSelectedItem();

		if (selectedMovie != null) {
			moviePickedTextField.setText(selectedMovie.getMovieName());
			showTicketPriceTextField.setText(String.valueOf(selectedMovie.getMovieTicketPrice()));
			showGenreTextField.setText(selectedMovie.getMovieGenre());
			moviesTableView.getSelectionModel().clearSelection();
			moviesTableView.setMouseTransparent(false);
		}
	}

	private boolean checkMovieDataValidationInput() {

		if (movieNameTextField.getText().trim().isEmpty() || moviePriceTextField.getText().trim().isEmpty()
				|| directorTextField.getText().trim().isEmpty() || genreTextField.getText().trim().isEmpty()
				|| durationHourTextField.getText().trim().isEmpty() || durationMinTextField.getText().trim().isEmpty()
				|| publishedDatePicker.getValue() == null) {
			showAlert("The data needs to be filled completely");
			return false;
		}

		if (!moviePriceTextField.getText().matches("\\d+")) {
			showAlert("Please, enter your movie price appropriately");
			return false;
		}

		if (!durationHourTextField.getText().matches("\\d+") || !durationMinTextField.getText().matches("\\d+")) {
			showAlert("Please, enter your movie duration appropriately");
			return false;
		}

		if (directorTextField.getText().matches(".*[0-9!@#$%^&*()_+={};':\",.<>?/\\-].*")) {
			showAlert("No symbols are allowed for the movie Director");
			return false;
		}

		int moviePrice = Integer.parseInt(moviePriceTextField.getText());
		if (moviePrice < 40 || moviePrice > 250) {
			showAlert("Your movie price has to range from 40 to 250");
			return false;
		}

		int movieDurationHour = Integer.parseInt(durationHourTextField.getText());
		int movieDurationMin = Integer.parseInt(durationMinTextField.getText());
		if (movieDurationHour > 10000 || movieDurationMin > 10000) {
			showAlert("No more than 10000 hours/minutes, please");
			return false;
		}

		if (!genreTextField.getText().matches("[a-zA-Z]+(/[a-zA-Z]+)?")) {
			showAlert("Please, enter your movie genre appropriately");
			return false;
		}

		List<String> validGenres = Arrays.asList("action", "adventure", "drama", "comedy", "thriller", "horror",
				"science fiction", "fantasy", "romance", "sci fi");

		String enteredGenre = genreTextField.getText().toLowerCase();
		String[] genres = enteredGenre.split("/");

		if (genres.length == 0) {
			showAlert("Please enter at least one movie genre");
			return false;
		}

		for (String genre : genres) {

			if (!validGenres.contains(genre.trim())) {
				showAlert("Please, enter a valid movie genre");

				return false;
			}
		}

		return true;
	}

	private void insertDataShows() {

		showID++;

		String showTitle = moviePickedTextField.getText().trim();
		String showGenre = showGenreTextField.getText().trim();
		int showTicketPrice = Integer.parseInt(showTicketPriceTextField.getText().trim());
		int showTimeHour = Integer.parseInt(showTimeHourTextField.getText().trim());
		int showTimeMin = Integer.parseInt(showTimeMinTextField.getText().trim());
		int showDay = Integer.parseInt(showDayTextField.getText().trim());
		int showMonth = Integer.parseInt(showMonthTextField.getText().trim());

		Shows show = new Shows(showID, showTitle, showTicketPrice, showGenre, showTimeHour, showTimeMin, showDay,
				showMonth);

		Admin.addShow(show);

		showsTableView.setItems(Admin.getShowsList());

		clearTextFieldsShows();

	}

	private void deleteDataShows() {

		Shows selectedShow = showsTableView.getSelectionModel().getSelectedItem();

		if (selectedShow != null) {
			Admin.removeShow(selectedShow);
			clearTextFieldsShows();
		}

	}

	private void clearTextFieldsShows() {

		moviePickedTextField.clear();
		showTicketPriceTextField.clear();
		showGenreTextField.clear();
		showTimeHourTextField.clear();
		showTimeMinTextField.clear();
		showDayTextField.clear();
		showMonthTextField.clear();
		showsTableView.getSelectionModel().clearSelection();

	}

	private void updateDataShows() {

		int selectedShowRowIndex = showsTableView.getSelectionModel().getSelectedIndex();

		if (selectedShowRowIndex >= 0) {

			Shows selectedShow = showsTableView.getItems().get(selectedShowRowIndex);

			String updatedMoviePicked = moviePickedTextField.getText();
			int updatedShowTicketPrice = Integer.parseInt(showTicketPriceTextField.getText());
			String updatedShowGenre = showGenreTextField.getText();
			int updatedShowTimeHour = Integer.parseInt(showTimeHourTextField.getText());
			int updatedShowTimeMin = Integer.parseInt(showTimeMinTextField.getText());
			int updatedShowDay = Integer.parseInt(showDayTextField.getText());
			int updatedShowMonth = Integer.parseInt(showMonthTextField.getText());

			selectedShow.setShowTitle(updatedMoviePicked);
			selectedShow.setShowTicketPrice(updatedShowTicketPrice);
			selectedShow.setShowGenre(updatedShowGenre);
			selectedShow.setShowDateAndTime(updatedShowTimeHour, updatedShowTimeMin, updatedShowDay, updatedShowMonth);

			Admin.editShow(selectedShowRowIndex, selectedShow);
			showsTableView.getItems().set(selectedShowRowIndex, selectedShow);

			clearTextFieldsShows();

		}
	}

	private void filterMovies1(String search1) {

		if (search1 == null || search1.trim().isEmpty()) {
			moviesTableView.setItems(Admin.getMoviesList());
		} else {
			ObservableList<Movies> filteredListMovies1 = Admin.getMoviesList().filtered(movie1 ->

			String.valueOf(movie1.getMovie_ID()).toLowerCase().contains(search1.toLowerCase())
					|| movie1.getMovieName().toLowerCase().contains(search1.toLowerCase())
					|| String.valueOf(movie1.getMovieTicketPrice()).toLowerCase().contains(search1.toLowerCase())
					|| movie1.getMovieDirector().toLowerCase().contains(search1.toLowerCase())
					|| movie1.getMovieGenre().toLowerCase().contains(search1.toLowerCase())
					|| movie1.getMovieDuration().toLowerCase().contains(search1.toLowerCase())
					|| String.valueOf(movie1.getMovieID()).toLowerCase().contains(search1.toLowerCase())
					|| String.valueOf(movie1.getPublishedMovieDate()).toLowerCase().contains(search1.toLowerCase()));
			moviesTableView.setItems(filteredListMovies1);

		}
	}

	private void filterShows(String search) {

		if (search == null || search.trim().isEmpty()) {
			showsTableView.setItems(Admin.getShowsList());
		} else {
			ObservableList<Shows> filteredListShows = Admin.getShowsList().filtered(show ->

			String.valueOf(show.getShow_ID()).toLowerCase().contains(search.toLowerCase())
					|| show.getShowTitle().toLowerCase().contains(search.toLowerCase())
					|| String.valueOf(show.getShowTicketPrice()).toLowerCase().contains(search.toLowerCase())
					|| show.getShowGenre().toLowerCase().contains(search.toLowerCase())
					|| String.valueOf(show.getShowID()).toLowerCase().contains(search.toLowerCase())
					|| show.getShowDateAndTime().toLowerCase().contains(search.toLowerCase()));
			showsTableView.setItems(filteredListShows);

		}
	}

	private Boolean checkShowDataValidationInput() {

		if (moviePickedTextField.getText().trim().isEmpty() || showTicketPriceTextField.getText().trim().isEmpty()
				|| showGenreTextField.getText().trim().isEmpty() || showDayTextField.getText().trim().isEmpty()
				|| showMonthTextField.getText().trim().isEmpty() || showTimeMinTextField.getText().trim().isEmpty()
				|| showTimeHourTextField.getText().trim().isEmpty()) {

			showAlert("The data needs to be filled completely");
			return false;
		}

		int showDay = Integer.parseInt(showDayTextField.getText());
		int showMonth = Integer.parseInt(showMonthTextField.getText());
		int showTimeHour = Integer.parseInt(showTimeHourTextField.getText());
		int showTimeMin = Integer.parseInt(showTimeMinTextField.getText());
		if (showTimeHour > 10000 || showTimeMin > 10000 || showDay > 10000 || showMonth > 10000) {
			showAlert("No more than 10000 hours/minutes (Day/Month) , please");
			return false;
		}

		return true;

	}

	private void saveMoviesData() {
		try (ObjectOutputStream oos = new ObjectOutputStream(new FileOutputStream(
				"E:\\MIU University Folder\\2nd Academic Year\\1st Semester\\Object Oriented Programming (OOP)\\OOP Project\\Project Progress\\MovieBookingTicketSystem\\src\\Files\\moviesData.bin"))) {
			oos.writeLong(movieID);
			List<Movies> serializableMoviesList = new ArrayList<>(Admin.getMoviesList());
			oos.writeObject(serializableMoviesList);
			Admin.fileSavingMoviesList();
			oos.close();
		} catch (IOException e) {
			e.printStackTrace();
		}
	}

	@SuppressWarnings("unchecked")
	private void loadMoviesData() {
		try (ObjectInputStream ois = new ObjectInputStream(new FileInputStream(
				"E:\\MIU University Folder\\2nd Academic Year\\1st Semester\\Object Oriented Programming (OOP)\\OOP Project\\Project Progress\\MovieBookingTicketSystem\\src\\Files\\moviesData.bin"))) {
			movieID = ois.readLong();
			List<Movies> loadedMoviesList = (List<Movies>) ois.readObject();
			Admin.loadMoviesList(loadedMoviesList);
			tableView.setItems(Admin.getMoviesList());
			moviesTableView.setItems(Admin.getMoviesList());
			ois.close();
		} catch (IOException | ClassNotFoundException e) {
			e.printStackTrace();
		}
	}

	private void saveShowsData() {
		try (ObjectOutputStream oos = new ObjectOutputStream(new FileOutputStream(
				"E:\\MIU University Folder\\2nd Academic Year\\1st Semester\\Object Oriented Programming (OOP)\\OOP Project\\Project Progress\\MovieBookingTicketSystem\\src\\Files\\showsData.bin"))) {
			oos.writeLong(showID);
			List<Shows> serializableShowsList = new ArrayList<>(Admin.getShowsList());
			oos.writeObject(serializableShowsList);
			Admin.fileSavingShowsList();
			oos.close();
		} catch (IOException e) {
			e.printStackTrace();
		}
	}

	@SuppressWarnings("unchecked")
	private void loadShowsData() {
		try (ObjectInputStream ois = new ObjectInputStream(new FileInputStream(
				"E:\\MIU University Folder\\2nd Academic Year\\1st Semester\\Object Oriented Programming (OOP)\\OOP Project\\Project Progress\\MovieBookingTicketSystem\\src\\Files\\showsData.bin"))) {
			showID = ois.readLong();
			List<Shows> loadedShowsList = (List<Shows>) ois.readObject();
			Admin.loadShowsList(loadedShowsList);
			showsTableView.setItems(Admin.getShowsList());
			ois.close();
		} catch (IOException | ClassNotFoundException e) {
			e.printStackTrace();
		}
	}

	private void showAlert(String message) {
		Alert alert = new Alert(AlertType.ERROR);
		alert.setTitle("Incorrect Input/Missing Data");
		alert.setHeaderText(null);
		alert.setContentText(message);
		alert.showAndWait();
	}

	private void sceneadd() throws FileNotFoundException, IOException {
		Group root = new Group();
		scene_search = new Scene(root, 800, 550, Color.BLACK);
		// ArrayList<User> arr = Admin.ReadUsers();
		Label l1 = new Label("Enter First Name: ");
		Label l5 = new Label("Enter Last Name: ");
		Label l2 = new Label("Enter Username: ");
		Label l3 = new Label("Enter Password: ");
		Label l4 = new Label("Choose your Role: ");

		TextField tf1 = new TextField();
		TextField tf2 = new TextField();
		TextField tf3 = new TextField();
		TextField tf4 = new TextField();

		ToggleGroup tg = new ToggleGroup();
		RadioButton r1 = new RadioButton("Guest");
		RadioButton r2 = new RadioButton("Receptionist");
		RadioButton r3 = new RadioButton("Admin");
		Button b1 = new Button();

		b1.setText("Submit");
		b1.setPrefHeight(40);
		b1.setPrefWidth(100);
		b1.setLayoutX(250);
		b1.setLayoutY(480);
		// b1.setOnAction(event -> primaryStage.setScene(scene1));
		b1.setOnAction(event -> {
			String firstName = tf1.getText();
			String lastName = tf4.getText();
			String userName = tf2.getText();
			String password = tf3.getText();

			if (firstName.isEmpty() || lastName.isEmpty() || userName.isEmpty() || password.isEmpty()) {
				showAlert("Please fill out all text fields.");
			} else if (!r1.isSelected() && !r2.isSelected() && !r3.isSelected()) {
				showAlert("Please choose a role.");
			} else {
				if (containsNumber(firstName) || containsNumber(lastName)) {
					showAlert("First name and last name should not contain numbers.");
				} else {
					String role;
					if (r1.isSelected()) {
						role = "Guest";
					} else if (r2.isSelected()) {
						role = "Receptionist";
					} else {
						role = "Admin";
					}

					// try {
					// Admin.checkUnique(userName);
					// } catch (FileNotFoundException e) {
					// e.printStackTrace();
					// } catch (IOException e) {
					// e.printStackTrace();
					// }

					if (role.equals("Guest")) {
						u = new Guest(firstName, lastName, 0, 0);
						u.setRole(role);
						int id = u.get_id();
						u.set_id(id);
						u.setUserName(userName);

					} else if (role.equals("Receptionist")) {

						u = new Receptionist(firstName, 0, 0, 0, lastName);
						u.setRole(role);
						u = new Receptionist(firstName, 0, 0, 0, lastName);
						u.setRole(role);
						int id = u.get_id();
						u.set_id(id);
						u.setUserName(userName);
						u.setPassword(password);
					} else if (role.equals("Admin")) {
						u = new Admin(firstName, lastName);
						int id = u.get_id();
						u.setRole(role);
						u.set_id(id);
						u.setUserName(userName);
						u.setPassword(password);
					}
					boolean x = Admin.searchUserInFile(userName);

					if (x) {
						Alert alert = new Alert(Alert.AlertType.INFORMATION);
						alert.setTitle("User Search");
						alert.setHeaderText(null);
						alert.setContentText("User already found ");
						alert.setGraphic(null); // Remove the red "x" icon
						alert.showAndWait();
					} else {

						Admin.adding_user_to_the_file(u);

						// stage.setScene(scene_search);
					}
				}
			}
			Stage.setScene(sceneAdmin);
		});

		r1.setLayoutX(320);
		r1.setLayoutY(430);
		r1.setTextFill(Color.WHITE);
		r1.setToggleGroup(tg);

		r2.setLayoutX(390);
		r2.setLayoutY(430);
		r2.setTextFill(Color.WHITE);
		r2.setToggleGroup(tg);

		r3.setLayoutX(490);
		r3.setLayoutY(430);
		r3.setTextFill(Color.WHITE);
		r3.setToggleGroup(tg);
		tf1.setLayoutX(330);
		tf1.setLayoutY(270);

		tf2.setLayoutX(330);
		tf2.setLayoutY(350);

		tf3.setLayoutX(330);
		tf3.setLayoutY(390);

		tf4.setLayoutX(330);
		tf4.setLayoutY(310);

		l1.setLayoutX(200);
		l1.setLayoutY(270);
		l1.setTextFill(Color.WHITE);
		l1.setFont(Font.font("Verdana", 13));

		l2.setLayoutX(200);
		l2.setLayoutY(350);
		l2.setTextFill(Color.WHITE);
		l2.setFont(Font.font("Verdana", 13));

		l3.setLayoutX(200);
		l3.setLayoutY(390);
		l3.setTextFill(Color.WHITE);
		l3.setFont(Font.font("Verdana", 13));

		l4.setLayoutX(200);
		l4.setLayoutY(430);
		l4.setTextFill(Color.WHITE);
		l4.setFont(Font.font("Verdana", 13));

		l5.setLayoutX(200);
		l5.setLayoutY(310);
		l5.setTextFill(Color.WHITE);
		l5.setFont(Font.font("Verdana", 13));
		root.getChildren().addAll(b1, l1, l2, l3, l4, l5, tf1, tf2, tf3, tf4, r1, r2, r3);
	}

	private boolean containsNumber(String text) {
		for (char c : text.toCharArray()) {
			if (Character.isDigit(c)) {
				return true;
			}
		}
		return false;
	}

	private void editscene() throws FileNotFoundException {
		Group root = new Group();
		edit_scene = new Scene(root, 800, 550, Color.BLACK);

		Label OL1 = new Label("Enter Old First Name: ");
		OL1.setLayoutX(50);
		OL1.setLayoutY(50);
		Label OL2 = new Label("Enter Old Last Name: ");
		OL2.setLayoutX(50);
		OL2.setLayoutY(100);

		Label OL3 = new Label("Enter Old Username: ");
		OL3.setLayoutX(50);
		OL3.setLayoutY(150);

		Label Ol4 = new Label("Enter Old Password: ");
		Ol4.setLayoutX(50);
		Ol4.setLayoutY(200);

		Label NO1 = new Label("Enter New First Name: ");
		NO1.setLayoutX(400);
		NO1.setLayoutY(50);

		Label NO2 = new Label("Enter New Last Name: ");
		NO2.setLayoutX(400);
		NO2.setLayoutY(100);

		Label NO3 = new Label("Enter New Username: ");
		NO3.setLayoutX(400);
		NO3.setLayoutY(150);

		Label NO4 = new Label("Enter New Password: ");
		NO4.setLayoutX(400);
		NO4.setLayoutY(200);

		Label NO5 = new Label("Choose New Role: ");
		NO5.setLayoutX(400);
		NO5.setLayoutY(250);

		TextField olf1 = new TextField();
		olf1.setLayoutX(200);
		olf1.setLayoutY(50);

		TextField olf2 = new TextField();
		olf2.setLayoutX(200);
		olf2.setLayoutY(100);

		TextField olf3 = new TextField();
		olf3.setLayoutX(200);
		olf3.setLayoutY(150);

		TextField olf4 = new TextField();
		olf4.setLayoutX(200);
		olf4.setLayoutY(200);

		TextField nof1 = new TextField();
		nof1.setLayoutX(550);// ...
		nof1.setLayoutY(50);

		TextField nof2 = new TextField();
		nof2.setLayoutX(550);// ...
		nof2.setLayoutY(100);

		TextField nof3 = new TextField();
		nof3.setLayoutX(550);// ...
		nof3.setLayoutY(150);

		TextField nof4 = new TextField();
		nof4.setLayoutX(550);// ...
		nof4.setLayoutY(200);

		ToggleGroup tg2 = new ToggleGroup();
		ToggleGroup tgg = new ToggleGroup();

		RadioButton rd1 = new RadioButton("Guest");
		rd1.setLayoutX(550);
		rd1.setLayoutY(250);
		rd1.setToggleGroup(tg2);
		RadioButton rd3 = new RadioButton("Receptionist");
		rd3.setLayoutX(550);
		rd3.setLayoutY(300);
		rd3.setToggleGroup(tg2);

		RadioButton rd4 = new RadioButton(" Admin");
		rd4.setLayoutX(550);
		rd4.setLayoutY(350);
		rd4.setToggleGroup(tg2);
		Button bte = new Button("Submit");
		bte.setPrefHeight(40);
		bte.setPrefWidth(100);
		bte.setLayoutX(250);
		bte.setLayoutY(480);

		RadioButton rd11 = new RadioButton("Guest");
		rd11.setLayoutX(200);
		rd11.setLayoutY(250);
		rd11.setToggleGroup(tgg);
		RadioButton rd31 = new RadioButton("Receptionist");
		rd31.setLayoutX(200);
		rd31.setLayoutY(300);
		rd31.setToggleGroup(tgg);

		RadioButton rd41 = new RadioButton("Admin");
		rd41.setLayoutX(200);
		rd41.setLayoutY(350);
		rd41.setToggleGroup(tgg);

		bte.setOnAction(event -> {
			String oldFirstName = olf1.getText();
			String oldLastName = olf2.getText();
			String oldUsername = olf3.getText();
			String oldPassword = olf3.getText();

			String newFirstName = nof1.getText();
			String newLastName = nof2.getText();
			String newUsername = nof3.getText();
			String newPassword = nof4.getText();

			if (oldFirstName.isEmpty() || oldLastName.isEmpty() || oldUsername.isEmpty() || oldPassword.isEmpty()
					|| newFirstName.isEmpty() || newLastName.isEmpty() || newUsername.isEmpty()
					|| newPassword.isEmpty()) {
				showAlert("Please fill out all text fields.");
			} else if (!rd1.isSelected() && !rd3.isSelected() && !rd4.isSelected() && rd11.isSelected()
					&& !rd31.isSelected() && !rd41.isSelected()) {
				showAlert("Please choose a role.");
			} else if (containsNumber(oldFirstName) || containsNumber(oldLastName) || containsNumber(newFirstName)
					|| containsNumber(newLastName)) {
				showAlert("First name and last name should not contain numbers.");
			}

			else {
				String newRole;
				if (rd1.isSelected()) {
					newRole = "Guest";
				} else if (rd3.isSelected()) {
					newRole = "Receptionist";
				} else {
					newRole = "Admin";
				}

				String Role;
				if (rd1.isSelected()) {
					Role = "Guest";
				} else if (rd3.isSelected()) {
					Role = "Receptionist";
				} else {
					Role = "Admin";
				}

				User oldUser = new User(oldFirstName, oldLastName, Role);
				User newUser = new User(newFirstName, newLastName, newRole);

				newUser.setUserName(newUsername);
				newUser.setPassword(newPassword);

				Admin admin = new Admin("zekkass", "zoookkaa"); // Assuming Admin class is instantiated here

				if (Admin.searchUserInFile(newUsername)) {
					Alert alert = new Alert(Alert.AlertType.INFORMATION);
					alert.setTitle("User Search");
					alert.setHeaderText(null);
					alert.setContentText("User already found ");
					alert.setGraphic(null);
					alert.showAndWait();
				}

				else if (!Admin.searchUserInFile(oldUsername)) {
					Alert alert2 = new Alert(Alert.AlertType.INFORMATION);
					alert2.setTitle("User Search");
					alert2.setHeaderText(null);
					alert2.setContentText("User not found ");
					alert2.setGraphic(null); // Remove the red "x" icon
					alert2.showAndWait();
				} else {

					Admin.remove_user_from_file(oldUsername);

					Admin.adding_user_to_the_file(newUser);
					// stage.setScene(edit_scene);
					Stage.setScene(sceneAdmin);

				}

			}
		});
		root.getChildren().addAll(OL1, olf1, OL2, olf2, OL3, olf3, Ol4, olf4, NO1, nof1, NO2, nof2, NO3, nof3, NO4,
				nof4, NO5, rd1, rd3, rd4, bte, rd11, rd31, rd41);
	}

	private void removescene() {

		Group root = new Group();
		remove_scene = new Scene(root, 800, 550, Color.BLACK);
		Label OL1 = new Label("Enter  First Name: ");
		OL1.setLayoutX(50);
		OL1.setLayoutY(50);
		Label OL2 = new Label("Enter  Last Name: ");
		OL2.setLayoutX(50);
		OL2.setLayoutY(100);

		Label OL3 = new Label("Enter  Username: ");
		OL3.setLayoutX(50);
		OL3.setLayoutY(150);

		Label Ol4 = new Label("Enter  Password: ");
		Ol4.setLayoutX(50);
		Ol4.setLayoutY(200);
		TextField olf1 = new TextField();
		olf1.setLayoutX(200);
		olf1.setLayoutY(50);

		TextField olf2 = new TextField();
		olf2.setLayoutX(200);
		olf2.setLayoutY(100);

		TextField olf3 = new TextField();
		olf3.setLayoutX(200);
		olf3.setLayoutY(150);

		TextField olf4 = new TextField();
		olf4.setLayoutX(200);
		olf4.setLayoutY(200);
		ToggleGroup tgg = new ToggleGroup();
		RadioButton rd11 = new RadioButton("Guest");
		rd11.setLayoutX(200);
		rd11.setLayoutY(250);
		rd11.setToggleGroup(tgg);
		RadioButton rd31 = new RadioButton("Receptionist");
		rd31.setLayoutX(200);
		rd31.setLayoutY(300);
		rd31.setToggleGroup(tgg);
		RadioButton rd41 = new RadioButton("Admin");
		rd41.setLayoutX(200);
		rd41.setLayoutY(350);
		rd41.setToggleGroup(tgg);
		String Role;
		if (rd11.isSelected()) {
			Role = "Guest";
		} else if (rd31.isSelected()) {
			Role = "Receptionist";
		} else if (rd41.isSelected()) {
			Role = "Admin";
		} else
			Role = "Admin";

		Button submitButton = new Button("Submit");
		submitButton.setPrefHeight(40);
		submitButton.setPrefWidth(100);
		submitButton.setLayoutX(250);
		submitButton.setLayoutY(480);

		submitButton.setOnAction(event -> {
			String firstName = olf1.getText();
			String lastName = olf2.getText();
			String username = olf3.getText();
			String password = olf4.getText();
			if (firstName.isEmpty() || lastName.isEmpty() || username.isEmpty() || password.isEmpty()) {
				showAlert("Please fill out all text fields.");
			} else if (!rd11.isSelected() && !rd31.isSelected() && !rd41.isSelected()) {
				showAlert("Please choose a role.");
			} else if (containsNumber(firstName) || containsNumber(lastName)) {
				showAlert("First name and last name should not contain numbers.");
			} else {
				User userToRemove = new User(firstName, lastName, Role);
				userToRemove.setUserName(username);
				userToRemove.setPassword(password);
				boolean x = Admin.searchUserInFile(username);
				if (!x) {
					Alert alert = new Alert(Alert.AlertType.INFORMATION);
					alert.setTitle("User Search");
					alert.setHeaderText(null);
					alert.setContentText("User is not found .....you have to add it  ");
					alert.setGraphic(null); // Remove the red "x" icon
					alert.showAndWait();
				} else {
					Admin admin = new Admin("mostafa", "waleed"); // Assuming Admin class is instantiated here
					Admin.remove_user_from_file(username);
					Stage.setScene(sceneAdmin);

					// stage.setScene(remove_scene);
				}
			}
		});

		root.getChildren().addAll(
				// positionLabel, positionTextField,
				OL1, OL2, OL3, Ol4, olf1, olf2, olf3, olf4, rd11, rd31, rd41, submitButton);
	}

	private void search() {
		Group root = new Group();
		search_scene = new Scene(root, 800, 550, Color.BLACK);
		Label OL1 = new Label("Enter  First Name: ");
		OL1.setLayoutX(50);
		OL1.setLayoutY(50);
		Label OL2 = new Label("Enter  Last Name: ");
		OL2.setLayoutX(50);
		OL2.setLayoutY(100);

		Label OL3 = new Label("Enter  Username: ");
		OL3.setLayoutX(50);
		OL3.setLayoutY(150);

		Label Ol4 = new Label("Enter  Password: ");
		Ol4.setLayoutX(50);
		Ol4.setLayoutY(200);

		TextField olf1 = new TextField();
		olf1.setLayoutX(200);
		olf1.setLayoutY(50);

		TextField olf2 = new TextField();
		olf2.setLayoutX(200);
		olf2.setLayoutY(100);

		TextField olf3 = new TextField();
		olf3.setLayoutX(200);
		olf3.setLayoutY(150);

		TextField olf4 = new TextField();
		olf4.setLayoutX(200);
		olf4.setLayoutY(200);

		// TextField positionTextField = new TextField();
		// positionTextField.setLayoutX(200);
		// positionTextField.setLayoutY(250);

		ToggleGroup tgg = new ToggleGroup();

		RadioButton rd11 = new RadioButton("Guest");
		rd11.setLayoutX(200);
		rd11.setLayoutY(250);
		rd11.setToggleGroup(tgg);

		RadioButton rd31 = new RadioButton("Receptionist");
		rd31.setLayoutX(200);
		rd31.setLayoutY(300);
		rd31.setToggleGroup(tgg);

		RadioButton rd41 = new RadioButton("Admin");
		rd41.setLayoutX(200);
		rd41.setLayoutY(350);
		rd41.setToggleGroup(tgg);
		String Role;
		if (rd11.isSelected()) {
			Role = "Guest";
		} else if (rd31.isSelected()) {
			Role = "Receptionist";
		} else if (rd41.isSelected()) {
			Role = "Admin";
		} else
			Role = "Admin";

		Button submitButton = new Button("Submit");
		submitButton.setPrefHeight(40);
		submitButton.setPrefWidth(100);
		submitButton.setLayoutX(250);
		submitButton.setLayoutY(480);

		submitButton.setOnAction(event -> {
			String firstName = olf1.getText();
			String lastName = olf2.getText();
			String username = olf3.getText();
			String password = olf4.getText();

			if (firstName.isEmpty() || lastName.isEmpty() || username.isEmpty() || password.isEmpty()) {
				showAlert("Please fill out all text fields.");
			} else if (!rd11.isSelected() && !rd31.isSelected() && !rd41.isSelected()) {
				showAlert("Please choose a role.");
			} else if (containsNumber(firstName) || containsNumber(lastName)) {
				showAlert("First name and last name should not contain numbers.");
			} else {
				String role;

				if (rd11.isSelected()) {
					role = "Guest";
				} else if (rd31.isSelected()) {
					role = "Receptionist";
				} else {
					role = "Admin";
				}

				User u = new User(firstName, lastName, role);
				u.setUserName(username);
				u.setPassword(password);

				Admin admin = new Admin("mostafa", "waleed"); // Assuming Admin class is instantiated here
				boolean userExist = admin.searchUserInFile(username);

				if (userExist) {
					Alert alert = new Alert(Alert.AlertType.INFORMATION);
					alert.setTitle("User Search");
					alert.setHeaderText(null);
					alert.setContentText("User found in the file.");
					alert.setGraphic(null); // Remove the red "x" icon
					alert.showAndWait();
				} else {
					Alert alert = new Alert(Alert.AlertType.INFORMATION);
					alert.setTitle("User Search");
					alert.setHeaderText(null);
					alert.setContentText("User not found in the file.");
					alert.setGraphic(null); // Remove the red "x" icon
					alert.showAndWait();
				}

				// stage.setScene(search_scene);
				Stage.setScene(sceneAdmin);

			}
		});

		root.getChildren().addAll(
				// positionLabel, positionTextField,
				OL1, OL2, OL3, Ol4, olf1, olf2, olf3, olf4, rd11, rd31, rd41, submitButton);
	}

	public static void GUESTGUI(Scene guest, User client, Stage stage) {

		VBox menu = new VBox(25);
		guest = new Scene(menu, 800, 550, Color.PINK);
		GridPane ratings = new GridPane();
		Button ratingButton = new Button("Give Us Your Feedback!");
		ratingButton.setStyle("-fx-background-color: green;");
		ratingButton.setPrefSize(500, 100);
		Button historybutton = new Button("Check your history here!");
		// ImageView logo = new ImageView(new Image(new FileInputStream("")));
		menu.getChildren().setAll(ratingButton, historybutton);
		menu.setPadding(new Insets(5, 5, 5, 5));
		menu.setAlignment(Pos.CENTER);
		stage.setScene(guest);
		stage.setMaximized(false);
		stage.setTitle("Main menu");
		ratingButton.setOnAction(e -> {
			try {
				List<User> uuuu = Admin.ReadUsers();

				ObjectInputStream ois = new ObjectInputStream(new FileInputStream(
						"E:\\MIU University Folder\\2nd Academic Year\\1st Semester\\Object Oriented Programming (OOP)\\OOP Project\\Project Progress\\MovieBookingTicketSystem\\src\\Files\\moviesObservableListDataSaved.bin"));
				Movies e3 = (Movies) ois.readObject();
				ArrayList<Movies> movlist = new ArrayList<>();
						//movlist.add(e3);
			  
				ois.close();

				ratings.setAlignment(Pos.CENTER);
				ratings.setPadding(new Insets(10, 5, 5, 10));
				ratings.setVgap(15);
				ratings.setHgap(50);
				Button confButton = new Button("Confirm");
				ratings.add(confButton, 3, ratings.getRowCount() + 1);
				ArrayList<ComboBox> rateboxs = new ArrayList<>(movlist.size());
				for (int i = 0; i < movlist.size(); i++) {
					final ComboBox box = new ComboBox<>();
					box.getItems().addAll("1", "2", "3", "4", "5");
					box.setPrefSize(5, 5);
					rateboxs.add(box);
					ratings.add(new Label(movlist.get(i).getMovieName()), 1, i);
					ratings.add(rateboxs.get(i), 2, i);

				}
				confButton.setOnAction(event -> {
					try {

						BufferedWriter output = new BufferedWriter(new FileWriter("movierating.txt"));
						for (int i = 0; i < movlist.size(); i++) {

							output.write(movlist.get(i).getMovieName() + "\n");
							output.write(rateboxs.get(i).getValue().toString() + "\n");

						}

						output.close();

					} catch (IOException ee7866) {
					}

				});

			} catch (FileNotFoundException e1) {
				// TODO Auto-generated catch block
				e1.printStackTrace();
			} catch (IOException e1) {
				// TODO Auto-generated catch block
				e1.printStackTrace();
			} catch (ClassNotFoundException e1) {
				// TODO Auto-generated catch block
				e1.printStackTrace();
			}

			stage.setScene(new Scene(ratings));
		});

	}

	// Mazen start
	private void createBooking() {
		ShowsControler selectedShow = gc.getSelectionModel().getSelectedItem();
		if (selectedShow != null) {
			String selectedHall = hallComboBox.getValue();
			String selectedSeat = seatComboBox.getValue();

			if (selectedHall != null && selectedSeat != null) {
				// Show a new scene for entering guest information
				showGuestInformationDialog(selectedShow, selectedHall, selectedSeat);
			} else {
				displayMessage("Please choose both hall and seat.");
			}
		} else {
			displayMessage("Please select a show to book.");
		}
	}

	private void showGuestInformationDialog(ShowsControler selectedShow, String selectedHall, String selectedSeat) {
		Stage guestInfoStage = new Stage();
		guestInfoStage.setTitle("Guest Information");

		Label nameLabel = new Label("Guest Name:");
		TextField nameTextField = new TextField();

		Label lastNameLabel = new Label("Last Name:");
		TextField lastNameTextField = new TextField();

		Button confirmButton = new Button("Confirm");
		confirmButton.setOnAction(e -> {
			processGuestInformation(selectedShow, selectedHall, selectedSeat, nameTextField.getText(),
					lastNameTextField.getText());
			guestInfoStage.close();
		});

		VBox guestInfoLayout = new VBox(10);
		guestInfoLayout.getChildren().addAll(nameLabel, nameTextField, lastNameLabel, lastNameTextField, confirmButton);

		guestInfoScene = new Scene(guestInfoLayout, 300, 150);

		guestInfoStage.setScene(guestInfoScene);
		guestInfoStage.show();
	}

	private void processGuestInformation(ShowsControler selectedShow, String selectedHall, String selectedSeat,
			String guestName, String lastName) {
		String confirmationMessage = "Booking confirmed for " + selectedShow.getMovieName() + " in Hall " + selectedHall
				+ ", Seat " + selectedSeat + " for guest: " + guestName + " " + lastName;
		displayMessage(confirmationMessage);

		// Save booking information to a file
		saveBookingToFile(confirmationMessage, "E:\\MIU University Folder\\2nd Academic Year\\1st Semester\\Object Oriented Programming (OOP)\\OOP Project\\Project Progress\\MovieBookingTicketSystem\\RecepBookings.txt");
	}

	private void displayMessage(String message) {
		Alert alert = new Alert(Alert.AlertType.INFORMATION);
		alert.setTitle("Booking Confirmation");
		alert.setHeaderText(null);
		alert.setContentText(message);
		alert.showAndWait();
	}

	private void saveBookingToFile(String bookingInfo, String filePath) {
		try (BufferedWriter writer = new BufferedWriter(new FileWriter(filePath, true))) {
			writer.write(bookingInfo);
			writer.newLine();
		} catch (IOException e) {
			e.printStackTrace();
		}
	}

	public ObservableList<ShowsControler> getShows() {
		ObservableList<ShowsControler> k = FXCollections.observableArrayList();
		k.add(new ShowsControler("spider ", "from 6 to 8", 120, 10));
		k.add(new ShowsControler("Batman ", "from 7 to 9", 120, 12));
		k.add(new ShowsControler("catwomen ", "from 8 to 10", 120, 15));
		k.add(new ShowsControler("kaha ", "from 8 to 10", 120, 15));
		return k;

	}

}
