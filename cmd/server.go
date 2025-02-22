/*
Copyright © 2024 Lukas Werner <me@lukaswerner.com>
*/
package cmd

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"

	"github.com/lukasmwerner/mark/store"
	"github.com/spf13/cobra"
)

// serverCmd represents the server command
var serverCmd = &cobra.Command{
	Use:   "server",
	Short: "Local HTTP server for managing bookmarks",
	Long:  `Designed for hosting for applications where there is no strong storage api that can easily be synchronized with Dropbox, Google Drive, Syncthing or other cloud storage sync services.`,
	Run: func(cmd *cobra.Command, args []string) {
		db, err := store.Open()
		if err != nil {
			fmt.Println("error occured in opening db: ", err.Error())
			return
		}

		http.Handle("GET /api/bookmarks/search", AuthRequired(db, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			query := r.URL.Query().Get("q")
			if query == "" {
				http.Error(w, "Missing query parameter", http.StatusBadRequest)
				return
			}
			bookmarks, err := store.SearchBookmarks(db, query)
			if err != nil {
				http.Error(w, err.Error(), http.StatusInternalServerError)
				return
			}
			w.Header().Set("Content-Type", "application/json")
			jsonBytes, err := json.Marshal(bookmarks)
			if err != nil {
				http.Error(w, err.Error(), http.StatusInternalServerError)
				return
			}
			w.Write(jsonBytes)
		})))

		http.Handle("POST /api/bookmarks", AuthRequired(db, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.Method != http.MethodPost {
				http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
				return
			}
			var bookmark store.Bookmark
			if err := json.NewDecoder(r.Body).Decode(&bookmark); err != nil {
				http.Error(w, err.Error(), http.StatusBadRequest)
				return
			}
			id, err := store.InsertBookmark(db, bookmark)
			if err != nil {
				http.Error(w, err.Error(), http.StatusInternalServerError)
				return
			}
			w.WriteHeader(http.StatusCreated)
			w.Write(fmt.Appendf([]byte{}, `{"id": %d}`, id))
		})))

		http.Handle("PATCH /api/bookmarks", AuthRequired(db, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			var submittedBookmark store.Bookmark
			if err := json.NewDecoder(r.Body).Decode(&submittedBookmark); err != nil {
				http.Error(w, err.Error(), http.StatusBadRequest)
				return
			}

			originalBookmarkUrl := r.URL.Query().Get("url")

			var originalBookmark store.Bookmark
			originalBookmark.Url = originalBookmarkUrl

			if err := store.UpdateBookmark(db, originalBookmark, submittedBookmark); err != nil {
				http.Error(w, err.Error(), http.StatusInternalServerError)
				return
			}
			w.WriteHeader(http.StatusNoContent)
		})))

		http.Handle("GET /api/bookmarks", AuthRequired(db, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			url := r.URL.Query().Get("url")

			bookmarks, err := store.GetBookmark(db, url)
			if err == sql.ErrNoRows {
				http.Error(w, "Bookmark not found", http.StatusNotFound)
				return
			}
			if err != nil {
				http.Error(w, err.Error(), http.StatusInternalServerError)
				return
			}
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(bookmarks)
		})))

		log.Fatal(http.ListenAndServe(":1990", nil))
	},
}

func AuthRequired(db *store.DB, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {

		bearer := r.Header.Get("Authorization")
		if bearer == "" {
			http.Error(w, "Missing Authorization header", http.StatusUnauthorized)
			return
		}

		token := strings.TrimPrefix(bearer, "Bearer ")

		if token == "" {
			http.Error(w, "Invalid Authorization header", http.StatusUnauthorized)
			return
		}

		exists, err := store.HasKey(db, token)
		if err != nil {
			fmt.Println(err)
			http.Error(w, "Invalid token", http.StatusUnauthorized)
			return
		}

		if exists {
			next.ServeHTTP(w, r)
		} else {
			fmt.Println("Unauthorized, token not found: ", token[:10])
			http.Error(w, "Unauthorized", http.StatusUnauthorized)
		}
	})
}

func init() {
	rootCmd.AddCommand(serverCmd)

	// Here you will define your flags and configuration settings.

	// Cobra supports Persistent Flags which will work for this command
	// and all subcommands, e.g.:
	// serverCmd.PersistentFlags().String("foo", "", "A help for foo")

	// Cobra supports local flags which will only run when this command
	// is called directly, e.g.:
	// serverCmd.Flags().BoolP("toggle", "t", false, "Help message for toggle")
}
