/*
Copyright © 2025 Lukas Werner <me@lukaswerner.com>
*/
package cmd

import (
	"fmt"
	"log"

	"github.com/lukasmwerner/mark/store"
	"github.com/spf13/cobra"
)

// keysCmd represents the keys command
var keysCmd = &cobra.Command{
	Use:   "keys",
	Short: "A brief description of your command",
	Long: `A longer description that spans multiple lines and likely contains examples
and usage of using your command. For example:

Cobra is a CLI library for Go that empowers applications.
This application is a tool to generate the needed files
to quickly create a Cobra application.`,
	Run: func(cmd *cobra.Command, args []string) {
		db, err := store.Open()
		if err != nil {
			log.Fatal(err)
		}
		defer db.Close()

		keys, err := store.GetKeys(db)
		if err != nil {
			log.Fatal(err)
		}
		for _, key := range keys {
			fmt.Println(key)
		}

	},
}

func init() {
	rootCmd.AddCommand(keysCmd)

	// Here you will define your flags and configuration settings.

	// Cobra supports Persistent Flags which will work for this command
	// and all subcommands, e.g.:
	// keysCmd.PersistentFlags().String("foo", "", "A help for foo")

	// Cobra supports local flags which will only run when this command
	// is called directly, e.g.:
	// keysCmd.Flags().BoolP("toggle", "t", false, "Help message for toggle")
}
