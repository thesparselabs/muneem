// devsign: developer helper for the device-signature scheme (README "Request conventions").
//
//	devsign keygen                          → prints PRIV=<base64 seed> PUB=<base64 public key>
//	devsign ulid                            → prints a fresh ULID
//	devsign sign <priv> <METHOD> <PATH> <TS> [bodyfile]  → prints base64 signature
package main

import (
	"crypto/ed25519"
	"crypto/rand"
	"encoding/base64"
	"fmt"
	"os"

	"github.com/oklog/ulid/v2"

	"github.com/sparselabs/muneem/cloud/internal/device"
)

func main() {
	if len(os.Args) < 2 {
		fmt.Fprintln(os.Stderr, "usage: devsign keygen | devsign sign <priv> <METHOD> <PATH> <TS> [bodyfile]")
		os.Exit(2)
	}
	switch os.Args[1] {
	case "ulid":
		fmt.Print(ulid.Make().String())
	case "keygen":
		pub, priv, err := ed25519.GenerateKey(rand.Reader)
		if err != nil {
			panic(err)
		}
		fmt.Printf("PRIV=%s\nPUB=%s\n", base64.StdEncoding.EncodeToString(priv.Seed()), base64.StdEncoding.EncodeToString(pub))
	case "sign":
		if len(os.Args) < 6 {
			fmt.Fprintln(os.Stderr, "usage: devsign sign <priv> <METHOD> <PATH> <TS> [bodyfile]")
			os.Exit(2)
		}
		seed, err := base64.StdEncoding.DecodeString(os.Args[2])
		if err != nil || len(seed) != ed25519.SeedSize {
			fmt.Fprintln(os.Stderr, "bad private key")
			os.Exit(2)
		}
		var body []byte
		if len(os.Args) > 6 {
			body, err = os.ReadFile(os.Args[6])
			if err != nil {
				panic(err)
			}
		}
		priv := ed25519.NewKeyFromSeed(seed)
		fmt.Print(base64.StdEncoding.EncodeToString(ed25519.Sign(priv, device.SigningString(os.Args[3], os.Args[4], os.Args[5], body))))
	default:
		os.Exit(2)
	}
}
